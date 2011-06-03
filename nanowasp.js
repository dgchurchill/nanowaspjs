
window.onload = function () {
    var pressedKeys = [];
    window.onkeydown = function (event) {
        pressedKeys[event.keyCode] = true;
        return false;
    };
    
    window.onkeyup = function (event) {
        pressedKeys[event.keyCode] = false;
        return false;
    };
    
    var graphicsContext = document.getElementById("vdu").getContext('2d');
    
    var microbee = new nanowasp.MicroBee(graphicsContext, pressedKeys);
            
    var pc_span = document.getElementById("pc");

    microbee.setSliceDoneCallback(function () {
        pc_span.textContent = z80.pc.toString() + " - " + readbyte_internal(z80.pc); 
    });

    document.getElementById("start_button").onclick = microbee.start.bind(microbee); 
    document.getElementById("stop_button").onclick = microbee.stop.bind(microbee); 
    document.getElementById("reset_button").onclick = microbee.reset.bind(microbee); 
};
