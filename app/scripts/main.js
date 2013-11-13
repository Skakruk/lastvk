'use strict';
var app = {
    apikeys: {
        vk: 3992322,
        last: {
            apiKey: 'e5b0685046dd1fdcf351e21ad6728ad2',
            apiSecret: '8e92d9f73e07eaece388a3aa74d35988'
        }
    },
    artists: [],
    playlist: [],
    vk: {}
};
var player;
var isLastAuthorized = false;
var isVKAuthorized = false;
var loginsModal;
var currentIndex = -1;
var cache = new LastFMCache();

/* Create a LastFM object */
var lastfm = new LastFM({
    apiKey: app.apikeys.last.apiKey,
    apiSecret: app.apikeys.last.apiSecret,
    cache: cache
});

$(document).ready(function() {
    loginsModal = $('#loginsModal').modal();

    player = $('#player').jPlayer({
        swfPath: 'scripts/jplayer',
        supplied: 'mp3',
        wmode: 'window',
        smoothPlayBar: true,
        keyEnabled: true,
        volume: 0.4,
        ended: function(){
            currentIndex++;
            $('#playlist a:eq(' + currentIndex +')').trigger('click');
        }
    });
    $('.jp-next').on('click', function(e){
        e.preventDefault();
        currentIndex++;
        $('#playlist a:eq(' + currentIndex +')').trigger('click');
    });

    VK.init({
        apiId: app.apikeys.vk
    });

    var lfmToken = getParameterByName('token') || localStorage.lastToken;

    localStorage.lastToken = lfmToken;

    if (lfmToken.length > 0) {
        isLastAuthorized = true;
        $('#search').prop('disabled', false);
        $('#last-login').prop('disabled', true);
        if(isVKAuthorized){
            loginsModal.modal('hide');
        }
    }else{
        loginsModal.modal('show');
    }

    function authInfo(response) {

        if (response.session) {
            VK.Api.call('users.get', {
                uids: response.session.mid
            }, function(r) {
                if (r.response) {
                    response.session = $.merge(response.session, r.response[0]);
                }
            });
            isVKAuthorized = true;
            localStorage.setItem('vk', JSON.stringify(response.session));
            app.vk = response.session;
            $('#vk-login').prop('disabled', true);
            if(isLastAuthorized){
                loginsModal.modal('hide');
            }
        } else {
            loginsModal.modal('show');
        }
    }

    VK.Auth.getLoginStatus(authInfo);

    $('#vk-login').on('click', function(e) {
        e.preventDefault();
        if(!$(this).is(':disabled'))
            VK.Auth.login(authInfo, VK.access.AUDIO);
    });

    $('#last-login').on('click', function(e) {
        e.preventDefault();
        if(!$(this).is(':disabled'))
            window.location = 'http://www.last.fm/api/auth/?api_key='+app.apikeys.last.apiKey+'&cb=http://last.vk';
    });

    $('#search-form').on('submit', function(e) {
        e.preventDefault();
        var query = $('#search-query').val();
        /* Load some artist info. */
        lastfm.user.getTopArtists({
            user: query
        }, {
            success: function(data) {
                app.artists = $.merge(app.artists, data.topartists.artist);
                $('#playlist').trigger('artistsLoaded', [data.topartists.artist]);
            },
            error: function(code, message) {
                console.log(code, message);
            }
        });

        $('#loading').addClass('in');
    });

    function loadSongs(artist, thissongs) {
        var def = new $.Deferred();
        var data = {
            limit: 10
        };
        if (artist.mbid.length > 0) {
            $.extend(data, {
                mbid: artist.mbid
            });
        } else {
            $.extend(data, {
                artist: artist.name
            });
        }
        lastfm.artist.getTopTracks(data, {
            success: function(data) {
                app.playlist = $.merge(app.playlist, data.toptracks.track);
                thissongs = $.merge(thissongs, data.toptracks.track);
                def.resolve(thissongs);
            },
            error: function(code, message) {
                console.log(code, message);
            }
        });
        return def.promise();
    }

    $('#playlist').on('artistsLoaded', function(e, newArtists) {
        var thissongs = [];
        var pipe = [];
        $.each(newArtists, function(ind, artist) {
            pipe.push(loadSongs(artist, thissongs));
        });
        //console.log(pipe);
        $.when.apply($, pipe).then(function(newSongs) {
            $('#playlist').trigger('playlistUpdated', [newSongs]);
        });
    })
        .on('playlistUpdated', function(e, songs) {
            songs = shuffleArray(songs);
            var me = this;
            $.each(songs, function(ind, song) {
                var row = $('<a href="#" class="list-group-item">' + song.artist.name + ' - ' + song.name + '</a>');
                row.data('song', song);
                $(me).append(row);
            });
            $('#loading').removeClass('in');
            currentIndex++;
            $('#playlist a:eq(' + currentIndex +')').trigger('click');
        });
    $('#playlist').on('click', 'a', function(e) {
        e.preventDefault();
        currentIndex = $(this).index();
        var selEl = $(this);
        var curSong = selEl.data('song');
        var exactSongs = [];
        $('#playlist a').removeClass('active');
        selEl.addClass('active');
        var query = curSong.artist.name + ' - ' + curSong.name;
        VK.Api.call('audio.search', {
            q: query,
            sort: 2,
            count: 10
        }, function(r) {
            if (r.response) {
                var vsongs = r.response.splice(1);
                $.each(vsongs, function(ind, song) {
                    if (song.artist === curSong.artist.name &&
                        song.title === curSong.name) {
                        exactSongs.push(song);
                    }
                });
                if (exactSongs.length === 0) {
                    exactSongs = shuffleArray(vsongs);
                }
                player.jPlayer('setMedia', {
                    mp3: exactSongs[Math.floor(Math.random()*exactSongs.length)].url
                });
                player.jPlayer('load');
                player.jPlayer('play');

            }
        });

    });

    
});
