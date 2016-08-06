// -------------------------------------------------------
// roughly https://github.com/mdn/voice-change-o-matic/blob/gh-pages/scripts/app.js#L128-L205

function OscilloscopeVisualizer(context, canvas) {
	var canvasCtx = canvas.getContext("2d");

	var analyser = context.createAnalyser();
	analyser.minDecibels = -90;
	analyser.maxDecibels = -10;
	analyser.smoothingTimeConstant = 0;	// 0..1; 0 : no smoothing

	function visualize() {
		WIDTH = canvas.width;
		HEIGHT = canvas.height;

		analyser.fftSize = 2048 / 2;
		var bufferLength = analyser.fftSize;
		var dataArray = new Uint8Array(bufferLength);

		canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

		function draw() {
			requestAnimationFrame(draw);

			analyser.getByteTimeDomainData(dataArray);

			canvasCtx.fillStyle = 'rgba(17, 17, 17, .25)';
			canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

			canvasCtx.lineWidth = 8;
			canvasCtx.lineJoin = 'round';
			canvasCtx.lineCap = 'round';

			canvasCtx.beginPath();

			var sliceWidth = WIDTH * 1.0 / bufferLength;
			var x = 0;

			var maxAmp = 0;
			for(var i = 0; i < bufferLength; i++)
			{
				maxAmp = Math.max(
					Math.abs((128 - dataArray[i]) / 128.0),
					maxAmp
				);
			}
			canvasCtx.strokeStyle = 'rgba(80, 80, 80, ' + Math.pow(maxAmp, .5) + ')';
			
			for(var i = 0; i < bufferLength; i++)
			{
				var v = dataArray[i] / 128.0;
				var y = v * HEIGHT/2;

				if(i === 0) {
					canvasCtx.moveTo(x, y);
				} else {
					canvasCtx.lineTo(x, y);
				}

				x += sliceWidth;
			}

			canvasCtx.lineTo(canvas.width, canvas.height/2);
			canvasCtx.stroke();
		};

		draw();
	}

	visualize();
	
	this.input = analyser;
}