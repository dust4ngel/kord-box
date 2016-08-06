angular.module('kordbox', [])
	.directive('myTouchstart', [function() {
		return function(scope, element, attr) {
			element.on('touchstart', function(event) {
				scope.$apply(function() { 
					scope.$eval(attr.myTouchstart); 
				});
			});
		};
	}])
	.directive('myTouchend', [function() {
		return function(scope, element, attr) {
			element.on('touchend', function(event) {
				scope.$apply(function() { 
					scope.$eval(attr.myTouchend); 
				});
			});
		};
	}]);

angular.module('kordbox').factory('pitchService', function() {
	var midi = {
		'C' : 0,
		'D' : 2,
		'E' : 4,
		'F' : 5,
		'G' : 7,
		'A' : 9,
		'B' : 11
	};
	return {
		// in : letter like B or C#; and a target midi value
		// out : how to label a pitch with that letter to match that value
		getLabel : function(letter, value) {
			var target = (value + 120) % 12;	// simple way to deal with negatives
			letter = letter[0];
			// this dictionary is weird to handle boundary scenarios
			return letter + {
				11 : '♭',
				10 : '♭♭',
				'-2' : '♭♭',
				'-1' : '♭',
				0 : '',
				1 : '♯',
				2 : '♯♯',
				'-11' : '♯',
				'-10' : '♯♯'
			}[ target - midi[letter] ];
		},
		// in : label like C♯♯
		// out : midi value like 0..11
		getValue : function(label) {
			var letter = label[0];
			var accidentals = label.substr(1) || "";
			return (midi[letter] + {
				'♭♭' : -2,
				'♭' : -1,
				"" : 0,
				'♯' : 1,
				'♯♯' : 2
			}[accidentals] + 12 ) % 12;
		}
	};
});
	
angular.module('kordbox').directive('chord', ['$timeout', function($timeout) {
	return {
		restrict: 'E',
		templateUrl: 'templates/chord.html',
		controller : function($scope, pitchService, midiAdapter) {
			var middleC = 60;
			
			$scope.scales = [
				{ label: 'maj', pattern: [ 0, 2, 4, 5, 7, 9, 11 ] },
				{ label: 'min', pattern: [ 0, 2, 3, 5, 7, 8, 10 ] },
				{ label: 'h-min', pattern: [ 0, 2, 3, 5, 7, 8, 11 ] }
			];
			
			$scope.chord = $scope.chord;
			$scope.chord.scale = 0;
			$scope.chord.degrees = [];
			
			function fillDegrees() {
				// create new degree space, but remember previous state
				var history = angular.copy($scope.chord.degrees);
				$scope.chord.degrees = [];
				
				var height = 10;
				var offset = -3;	// to do : calculate rather than specify
				for( var row = 0; row < height; row++ ) {
					var letters = "CDEFGAB".split('');
					var letter = letters[ ( letters.indexOf($scope.key[0]) + row + offset + 7 ) % 7 ];
					
					var keyRoot = pitchService.getValue($scope.key);
					keyRoot = keyRoot > 6 ? keyRoot - 12 : keyRoot; // keep key centered around middle C
					var scaleDegree = $scope.scales[$scope.chord.scale].pattern[ (row + offset + 7) % 7 ];
					var octave = (Math.floor( (row + offset) / 7 ) + $scope.offset ) * 12;
					var value = middleC + keyRoot + scaleDegree + octave;
					
					var label = pitchService.getLabel(letter, value);
					
					var index = height - 1 - row;
					$scope.chord.degrees.unshift({
						extended : row + offset < 0 || row + offset > 6,
						label : label,
						value : value,
						isActive : history[index] ? history[index].isActive : false
					});
				}
			}
			
			$scope.toggle = function(index) {
				var cell = $scope.chord.degrees[index];
				cell.isActive = !cell.isActive;
				if(cell.isActive)	{
					$scope.chord.event = midiAdapter.trigger([cell.value]);
				}
			}
			
			$scope.afterToggle = function(index) {
				var cell = $scope.chord.degrees[index];
				if(cell.isActive && $scope.chord.event)	{
					$scope.chord.event = $scope.chord.event.release();
				}
			}
			
			$scope.nextScale = function() {
				$scope.chord.scale = ($scope.chord.scale + 1) % $scope.scales.length;
				fillDegrees();
			}
			
			$scope.play = function() {
				var instance = $scope.chord;
				
				if(instance.isActive) return;
						 
				instance.isActive = true;
				
				var values = instance.degrees
					.filter(function(e) { return e.isActive; })
					.map(function(e) { return e.value; });
				
				instance.event = midiAdapter.trigger(values);
			}
					
			$scope.stop = function() {
				var instance = $scope.chord;
				if(instance.event)
					instance.event.release();
				// ios touchend+mouseup in quick succession kludge - see http://stackoverflow.com/a/8505370
				$timeout(function() { instance.isActive = false; }, 50);
			}
			
			$scope.$watch('key', function() { fillDegrees(); });
			
			$scope.$watch('offset', function() { fillDegrees(); });
		},
		scope:{
			chord : '=',
			key : '=',
			offset : '='
		},
		link: function (scope, element, attrs) {
			scope.$on('play:' + scope.index, function() { scope.play(); scope.$apply(); });
			scope.$on('stop:' + scope.index, function() { scope.stop(); scope.$apply(); });
		}
	};
}]);
	
angular.module('kordbox').controller('MpcCtrl', function ($scope, $document, MidiFormatter) {
	var empty = [ {}, {}, {}, {}, {}, {}, {}, {} ];
	$scope.chords = angular.copy(empty);
 
	$scope.key = 'C';
	$scope.keys = ['A♭', 'A', 'B♭', 'B', 'C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯'];
	
	$scope.ping = function() { console.log('ping'); }
	
	$scope.octaveOffset = 0;
	$scope.nextOctaveOffset = function() {
		$scope.octaveOffset += 1;
		if($scope.octaveOffset > 1)
			$scope.octaveOffset = -1;
	}
	
	$scope.clear = function() {
		for(var i=0; i < $scope.chords.length; i++) {
			for(var d=0; d < $scope.chords[i].degrees.length; d++) {
				$scope.chords[i].degrees[d].isActive = false;
			}
		}
	}

	$scope.getMidiUri = function() {
		var data = [];
		for( var i=0; i < $scope.chords.length; i++ ) {
			data.push(
				$scope.chords[i].degrees
					.filter(function(e) { return e.isActive; })
					.map(function(e) { return e.value; })
			);
		}
		var uri = MidiFormatter.getUri(data);
		prompt("Copy this link to download:", uri);
	};
	
	$document.on('keydown', function(e){
		if( e.keyCode >= 49 && e.keyCode <= 56 ) {
			var idx = e.keyCode - 49;
			$scope.$broadcast('play:' + ( idx ));
		}
	});
	$document.on('keyup', function(e){
		if( e.keyCode >= 49 && e.keyCode <= 56 ) {
			var idx = e.keyCode - 49;
			$scope.$broadcast('stop:' + ( idx ));
		}
	});
});