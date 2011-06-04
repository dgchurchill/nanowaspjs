
window.onload = function () {
    var pressedKeys = [];
    window.onkeydown = function (event) {
        pressedKeys[event.keyCode] = true;
        return false;
    };

    window.onkeypress = function (event) {
        return false;
    };

    window.onkeyup = function (event) {
        pressedKeys[event.keyCode] = false;
        return false;
    };

    var graphicsContext = document.getElementById("vdu").getContext('2d');
    
    var microbee = new nanowasp.MicroBee(graphicsContext, pressedKeys);
    microbee.restoreState(nanowasp.data.island);

    document.getElementById("start_button").onclick = microbee.start.bind(microbee); 
    document.getElementById("stop_button").onclick = microbee.stop.bind(microbee); 
    document.getElementById("reset_button").onclick = microbee.reset.bind(microbee); 
};
