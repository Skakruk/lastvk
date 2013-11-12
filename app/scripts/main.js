'use strict';
var app = {
    artists : [],
    playlist: [],
    vk : {}
};
var player;
var isLastAuthorized = false;

var cache = new LastFMCache();

/* Create a LastFM object */
var lastfm = new LastFM({
    apiKey    : 'e5b0685046dd1fdcf351e21ad6728ad2',
    apiSecret : '8e92d9f73e07eaece388a3aa74d35988',
    cache     : cache
});

$(document).ready(function(){

    player = $('#player').jPlayer({
        swfPath: 'scripts/jplayer',
        supplied: 'mp3',
        wmode: 'window',
        smoothPlayBar: true,
        keyEnabled: true
    });


    var lfmToken = getParameterByName('token') || localStorage.lastToken;

    localStorage.lastToken = lfmToken;

    if (lfmToken.length > 0) {
        isLastAuthorized = true;
        $('#search').prop('disabled', false);
    }

    $('#search').on('click', function(e){
        e.preventDefault();
        var query = $('#search-query').val();
        /* Load some artist info. */
        lastfm.user.getTopArtists({user : query}, {
            success: function(data){
                app.artists = $.merge(app.artists, data.topartists.artist);
                $('#playlist').trigger('artistsLoaded', [data.topartists.artist]);
            },
            error: function(code, message){
                console.log(code, message);
            }
        });
    });

    function loadSongs(artist, thissongs){
        var def = new $.Deferred();
        var data = {
            limit: 10
        };
        if(artist.mbid.length > 0){
            $.extend(data, {mbid : artist.mbid});
        }else{
            $.extend(data, {artist : artist.name});
        }
        lastfm.artist.getTopTracks(data, {
            success: function(data){
                app.playlist = $.merge(app.playlist, data.toptracks.track);
                thissongs = $.merge(thissongs, data.toptracks.track);
                def.resolve(thissongs);
            },
            error: function(code, message){
                console.log(code, message);
            }
        });
        return def.promise();
    }

    $('#playlist').on('artistsLoaded', function(e, newArtists) {
        var thissongs = [];
        var pipe = [];
        $.each(newArtists, function(ind, artist){
            pipe.push(loadSongs(artist, thissongs));
        });
        //console.log(pipe);
        $.when.apply($, pipe).done(function(newSongs){
            $('#playlist').trigger('playlistUpdated', [newSongs]);
        });
    })
    .on('playlistUpdated', function(e, songs){
        songs = shuffleArray(songs);
        var rows = '';
        var me = this;
        $.each(songs, function(ind, song){
            var row = $('<a href="#" class="list-group-item">' + song.artist.name+ ' - '+ song.name +'</a>');
            row.data('song', song);
            $(me).append(row);
        });
        
    });
    $('#playlist').on('click', 'a', function(e){
        e.preventDefault();
        var selEl = $(this);
        var curSong = selEl.data('song');
        var exactSongs = [];
        $('#playlist a').removeClass('active');
        selEl.addClass('active');
        var query = curSong.artist.name + ' - '+ curSong.name;
        VK.Api.call('audio.search', {q: query, sort: 2, count: 10}, function(r) { 
            if(r.response) { 
                var vsongs = r.response.splice(1);
                $.each(vsongs, function(ind, song){
                    if(song.artist === curSong.artist.name &&
                        song.title === curSong.name){
                        exactSongs.push(song);
                    }
                });
                if(exactSongs.length === 0){
                    exactSongs =  shuffleArray(vsongs);
                }
                console.log(exactSongs);
                player.jPlayer('setMedia', {
                    mp3: exactSongs[0].url
                });
                player.jPlayer('play');
            }
        });
        
    });


    VK.init({
        apiId: 3992322
    });

    function authInfo(response) {
        if (response.session) {
            VK.Auth.login(null, VK.access.AUDIO);
            localStorage.setItem('vk', JSON.stringify(response.session));
            app.vk = response.session;
        } else {

        }
    }
    VK.Auth.getLoginStatus(authInfo);
});

