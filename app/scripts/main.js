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
    vk: {},
    last: {
        sk: null
    },
    host: 'last.vk'
};

if (location.hostname === 'skakruk.github.io') {
    app.apikeys.vk = 4662184;
    app.host = 'skakruk.github.io/lastvk/app/';
}

var player;
var isLastAuthorized = false;
var isVKAuthorized = false;
var loginsModal;
var currentIndex = -1;
var cache = new LastFMCache();
var curSong;

/* Create a LastFM object */
var lastfm = new LastFM({
    apiKey: app.apikeys.last.apiKey,
    apiSecret: app.apikeys.last.apiSecret,
    cache: cache
});

function pushtoScrobbler(curSong) {
    if (!curSong.scrobbled) {
        var timestamp = Math.floor((new Date()).getTime() / 1000);
        lastfm.track.scrobble([{
            artist: curSong.artist.name,
            track: curSong.name,
            timestamp: timestamp
        }], {
            key: app.last.sk
        });
        curSong.scrobbled = true;
    }
}

function getLastToken() {

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
        if (isLastAuthorized) {
            loginsModal.modal('hide');
        }
    } else {
        $('#vk-login').prop('disabled', false);
        loginsModal.modal('show');
    }
}

function initApis() {
    if (app.last.sk && app.last.sk.length > 0) {
        isLastAuthorized = true;
        $('#search').prop('disabled', false);
        $('#last-login').prop('disabled', true);
        if (isVKAuthorized) {
            loginsModal.modal('hide');
        }
    } else {
        $('#last-login').prop('disabled', false);
        loginsModal.modal('show');
    }

    VK.Auth.getLoginStatus(authInfo);
}

function sidebarHeight() {
    var nH = +$(window).height() - 70;
    $('#sidebar').css('height', nH);
}
$(document).ready(function() {
    loginsModal = $('#loginsModal').modal({
        backdrop: 'static'
    });

    sidebarHeight();
    $(window).resize(function() {
        sidebarHeight();
    });

    player = $('#player').jPlayer({
        swfPath: 'scripts/jplayer',
        supplied: 'mp3',
        wmode: 'window',
        smoothPlayBar: true,
        keyEnabled: true,
        volume: 0.4,
        ended: function() {
            currentIndex++;
            $('#playlist a:eq(' + currentIndex + ')').trigger('click');
        },
        timeupdate: function(e) {
            if (e.jPlayer.status.currentTime > 30) {
                pushtoScrobbler(curSong);
            }
        },
        loadeddata: function() {
            curSong.scrobbled = false;
        }
    });
    $('.jp-next').on('click', function(e) {
        e.preventDefault();
        currentIndex++;
        $('#playlist a:eq(' + currentIndex + ')').trigger('click');
    });

    VK.init({
        apiId: app.apikeys.vk
    });

    app.lfmToken = getParameterByName('token');
    app.last = localStorage.last ? JSON.parse(localStorage.last) : {};

    if (app.lfmToken.length > 0) {
        lastfm.auth.getSession({
            token: app.lfmToken
        }, {
            success: function(data) {
                app.last.sk = data.session.key;
                localStorage.last = JSON.stringify({
                    sk: data.session.key
                });
                initApis();
            },
            error: function(code, message) {
                console.log(code, message);
            }
        });
    }

    initApis();

    $('#vk-login').on('click', function(e) {
        e.preventDefault();
        if (!$(this).is(':disabled'))
            VK.Auth.login(authInfo, VK.access.AUDIO);
    });

    $('#last-login').on('click', function(e) {
        e.preventDefault();
        if (!$(this).is(':disabled'))
            window.location = 'http://www.last.fm/api/auth/?api_key=' + app.apikeys.last.apiKey + '&cb=http://' + app.host;
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
            limit: 20,
            autocorrect: 1
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
                data.toptracks.track.artist = artist;
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


    function loadPipeSongs(artist, thissongs){
        var def = new $.Deferred();
        var data = {
            '_id' : '497d65876d1d3fab8ea3d33f61b82a90',
            '_render' : 'json',
            'api_key' : app.apikeys.last.apiKey,
            'mbid' :  artist.mbid,
            'limitsongs' : 30
        };
        if(data.mbid.length == 0){
            data.artistname = artist.name;
        }
        return $.ajax({
            dataType: "json",
            url: 'http://pipes.yahoo.com/pipes/pipe.run',
            data: data,
            jsonp: '_callback'
        }).always(function(response){
            if(response)
                $.each(response.value.items, function(ind, art){
                    if(art.songs !== null){
                        //data.toptracks.track.artist = artist
                        app.playlist = $.merge(app.playlist, art.songs);
                        thissongs = $.merge(thissongs, art.songs);
                    }
                })
        });
    }

    $('#playlist').on('artistsLoaded', function(e, newArtists) {
        var thissongs = [];
        var pipe = [];
        $.each(newArtists, function(ind, artist) {
            pipe.push(loadPipeSongs(artist, thissongs));
        });
         
        $.when.apply($, pipe).then(function(newSongs) {
           
            $('#playlist').trigger('playlistUpdated', [thissongs]);

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
        $('#playlist a:eq(' + currentIndex + ')').trigger('click');
    })

    .on('click', 'a', function(e) {
        e.preventDefault();
        var selEl = $(this);

        $('#playlist a').removeClass('active');
        selEl.addClass('active');

        currentIndex = $(this).index();

        curSong = selEl.data('song');

        var exactSongs = [];

        var query = curSong.artist.name + ' - ' + curSong.name;

        $('title').html(query);

        VK.Api.call('audio.search', {
            q: query,
            sort: 2,
            count: 10
        }, function(r) {
            if(r.error){
                if(r.error.error_code === 7){
                    VK.Auth.logout(function(){
                        $('#vk-login').prop('disabled', false);
                        loginsModal.modal('show');
                    });
                }
                return;
            }
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
                    mp3: exactSongs[Math.floor(Math.random() * exactSongs.length)].url
                });
                player.jPlayer('load');
                player.jPlayer('play');

                var songImgSrc = 'images/no-cover.jpg';

                if (curSong.image) {
                    songImgSrc = curSong.image[3]['_text'];
                } else if (curSong.artist.image) {
                    songImgSrc = curSong.image[3]['_text'];
                }

                $('#song-img').attr('src', songImgSrc);

                $('#song-title').html('<h1>' + curSong.name + ' <small>by ' + curSong.artist.name + '</small></h1>');
                $('#song-info').show();

                lastfm.track.getInfo({
                    mbid: curSong.mbid,
                    artist: curSong.artist.name,
                    track: curSong.name
                }, {
                    success: function(data) {
                        var track = data.track;
                        var tags = [];
                        if (track.album) {
                            $('#album-name').html(track.album.title).parent().show();
                        } else {
                            $('#album-name').parent().hide();
                        }
                        if (track.toptags.tag) {
                            for (var i in track.toptags.tag) {
                                tags.push(track.toptags.tag[i].name);
                            }
                            $('#track-genre').html(tags.join(', ')).parent().show();
                        } else {
                            $('#track-genre').parent().hide();
                        }
                    },
                    error: function(code, reason) {
                        console.log(code, reason);

                    }
                });

                lastfm.artist.getInfo({
                    mbid: curSong.artist.mbid,
                    artist: curSong.artist.name
                }, {
                    success: function(data) {
                        var artist = data.artist;
                        if (artist.bio.content) {
                            $('#bio').html(artist.bio.content.replace(/\n/g, '<br/>')).show();
                        } else {
                            $('#bio').hide();
                        }

                    },
                    error: function(code, reason) {
                        console.log(code, reason);

                    }
                });

            }
        });

    });


});
