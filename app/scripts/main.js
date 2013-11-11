/* global MediaElementPlayer:false*/

'use strict';

$(document).ready(function(){
    var player = new MediaElementPlayer('audio', {
        startVolume: 0.4
    });
    player.pause();
    player.setSrc('/audios/8bd50cae87e0.mp3');
    player.load();
    player.play();
});
