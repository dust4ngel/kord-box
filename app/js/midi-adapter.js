angular.module('kordbox').factory('midiAdapter', ['synthAdapter', function(synthAdapter) {
	var Chord = (function() {
		function midiToFreq(n) {
			// see : http://osdir.com/ml/audio.emagic.logic.off-topic/2000-09/msg00012.html
			return 440 * Math.pow(2, (n - 69) / 12 );
		}

		function Chord(midis, synth) {
			this.voices = [];
			for( var i=0; i < midis.length; i++ ) {
				this.voices.push(
					synth.startNew(midiToFreq(midis[i]))
				);
			}

			this.release = function() {
				this.voices.forEach(function(v) { v.stop(); });
			};
		}

		return Chord;
	})();
	
	var synth = new synthAdapter();
	
	return {
		trigger : function(midis) {
			var instance = new Chord(midis, synth);
			return { release : function() { instance.release(); } }
		}
	};
}]);

angular.module('kordbox').factory('synthAdapter', ['webaudioSynth', 'webkitSynth', function(webaudioSynth, webkitSynth) {
	if(window.AudioContext) {
		return webaudioSynth;
	} else {
		return webkitSynth;
	}
}]);

angular.module('kordbox').factory('webaudioSynth', [function() {
	function Synth(context, masterVolume)
	{
		this.startNew = function(frequency)
		{
			// variable-detuned stereo multi-waveform subtractive patch
			
			var osc = context.createOscillator();
			osc.frequency.value = frequency;
			osc.type = 'sawtooth';
			osc.detune.value = Math.round(Math.random() * -10);
			
			// osc 1 hard left
			var pan1 = context.createStereoPanner();
			pan1.pan.value = -1;

			var osc2 = context.createOscillator();
			osc2.frequency.value = frequency;
			osc2.type = 'sawtooth';
			osc2.detune.value = Math.round(Math.random() * 10);
			
			// osc 2 hard right
			var pan2 = context.createStereoPanner();
			pan2.pan.value = 1;

			var now = context.currentTime;

			// gain envelope
			var gain = context.createGain();
			gain.gain.setValueAtTime(.8, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 4);

			// LP envelope
			var filter = context.createBiquadFilter();
			filter.type = 'lowpass';
			filter.frequency.setValueAtTime(3675, now);
			filter.frequency.exponentialRampToValueAtTime(600, now + .2);

			osc.connect(pan1);
			pan1.connect(filter);
			filter.connect(gain);

			osc2.connect(pan2);
			pan2.connect(filter);
			filter.connect(gain);

			gain.connect(masterVolume);

			// ich tanze!
			osc.start(context.currentTime);
			osc2.start(context.currentTime);
			
			return {
				stop : function() {
					osc.stop(context.currentTime);
					osc2.stop(context.currentTime);
				}
			};
		}
	}
	
	return function() {
		var context = new AudioContext();
	
		var masterVolume = context.createGain();
		masterVolume.gain.value = 0.25;
		masterVolume.connect(context.destination);
		
		var oscilloscope = new OscilloscopeVisualizer(context, document.getElementById('osc'));
		masterVolume.connect(oscilloscope.input);
	
		return new Synth(context, masterVolume);
	};
}]);

angular.module('kordbox').factory('webkitSynth', [function() {
	function Synth(context, masterVolume)
	{
		this.startNew = function(frequency)
		{
			// super ghetto webkit version
			
			var osc = context.createOscillator();
			osc.frequency.value = frequency;
			osc.type = 'triangle';

			var now = context.currentTime;

			// gain envelope
			var gain = context.createGain();
			gain.gain.setValueAtTime(.8, now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + 4);

			osc.connect(gain);
			
			gain.connect(masterVolume);

			osc.start(context.currentTime);
			
			return {
				stop : function() {
					osc.stop(context.currentTime);
				}
			};
		}
	}
	
	return function() {
		var context = new webkitAudioContext();
	
		var masterVolume = context.createGain();
		masterVolume.gain.value = 0.25;
		masterVolume.connect(context.destination);
		
		return new Synth(context, masterVolume);
	};
}]);

// got midi data? serialize into a midi file.  this is mad ghetto (but effective!)
angular.module('kordbox').factory('MidiFormatter', function() {
    return {
        instrument : 4,	// 4 : EP, 0 : accoustic grand
        getTrack : function(chords) {
            // Midi event codes
            var EVT_NOTE_OFF           = 0x8;
            var EVT_NOTE_ON            = 0x9;
            var EVT_PROGRAM_CHANGE     = 0xC;

            var DEFAULT_VOLUME   = 90;
            var DEFAULT_DURATION = 256;
            var DEFAULT_CHANNEL  = 0;

            var noteEvents = [];
            noteEvents.push(
                new MidiEvent({
                    time : 0,
                    type : EVT_PROGRAM_CHANGE,
                    channel: DEFAULT_CHANNEL,
                    param1: this.instrument
                })
            );
            
            for( var c=0; c < chords.length; c++ ) {
                var notes = chords[c];
            
                for( var i=0; i < notes.length; i++ ) {
                    noteEvents.push(
                        new MidiEvent({
                            time:    0,
                            type:    EVT_NOTE_ON,
                            channel: DEFAULT_CHANNEL,
                            param1:  notes[i],
                            param2:  DEFAULT_VOLUME
                        })
                    );
                }
                for( var i=0; i < notes.length; i++ ) {
                    noteEvents.push(
                        new MidiEvent({
                            time:    i == 0 ? DEFAULT_DURATION : 0,
                            type:    EVT_NOTE_OFF,
                            channel: DEFAULT_CHANNEL,
                            param1:  notes[i],
                            param2:  DEFAULT_VOLUME
                        })
                    );
                }
            }

            var track = new MidiTrack({ events: noteEvents });
            return track;
        },
        getUri : function(chords) {
            var track = this.getTrack(chords);
            return "data:audio/midi;base64," + MidiWriter({ tracks: [track] }).b64;
        }
    };
});
