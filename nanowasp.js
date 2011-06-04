
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

    window.onblur = microbee.stop.bind(microbee);
    window.onfocus = microbee.start.bind(microbee);

    microbee.restoreState(nanowasp.data.basic);
    microbee.start();
};
