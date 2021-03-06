/**

  This file is part of dcpu16.js
  
  Copyright 2012 Michael Gerhaeuser
  
  https://github.com/migerh/dcpu16.js
  
  dcpu16.js is free software; You can redistribute it and/or
  modify it under the terms of the MIT license. You should have
  received a copy of the MIT license along with dcpu16.js. If not,
  see http://www.opensource.org/licenses/MIT

 **/
 
 
var DCPU16 = DCPU16 || {};

(function () {

	var _ = {
		// private stuff
		addEvent: function (obj, type, fn) {
			if (!obj) {
				return;
			}
			
			if (obj.addEventListener) {
				obj.addEventListener(type, fn, false);
			} else if (obj.attachEvent) {
				obj["e" + type + fn] = fn;
				// in case we want to remove the event handler
				obj[type + fn] = function() {
					obj["e" + type + fn](window.event);
				}
				obj.attachEvent("on"+type, obj[type+fn]);
			}
		},
		
		mod: {
			8: 0x10,	// backspace
			13: 0x11,	// return
			14: 0x11,
			45: 0x12,	// ins
			46: 0x13,	// Delete
			38: 0x80,	// Arrow up
			40: 0x81,	// Arrow down
			37: 0x82,	// Arrow left
			39: 0x83,	// Arrow right
			16: 0x90,	// Shift
			17: 0x91	// Control
		}
	};

	DCPU16.Keyboard = function (dcpu) {
		var that = this;
		
		this.description = 'Generic Keyboard';
		this.id = 0x30cf7406;
		this.version = 0x1;
		this.manufacturer = 0x000BA51C;
		
		// more properties
		this.buffer = [];
		this.message = 0;
		
		this.int = function () {
			var b = this.dcpu.ram.B;
			
			switch (this.dcpu.ram.A) {
			case 0:
				// Clear keyboard buffer
				this.buffer.length = 0;
				break;
			case 1:
				// Store next key typed in C register, or 0 if the buffer is empty
				this.dcpu.setWord('C', this.buffer.shift() || 0);
				break;
			case 2:
				// Set C register to 1 if the key specified by the B register is pressed, or 0 if it's not pressed
				this.dcpu.setWord('C', this.buffer.shift() === b);
				break;
			case 3:
				// If register B is non-zero, turn on interrupts with message B. If B is zero, disable interrupts
				this.message = b;
				break;
			}
		};
		
		// more methods
		this.keyPress = function (e) {
			var code = e.keyCode || e.which;
			
			code = _.mod[code] || code;
			this.buffer.push(code);
			if (this.message > 0) {
				this.dcpu.int(this.message);
			}
			
			return code;
		};
		
		// init
		this.dcpu = dcpu;
		this.dcpu.add(this);
		
		var shift = false;
		_.addEvent(document, 'keydown', function (e) {
			var code = e.keyCode || e.which;
			
			if(code == 16) { // 16 = shift keycode
				shift = true;
			} else if(_.mod[code] && that.dcpu.isRunning && e.target.nodeName.toLowerCase() !== 'input' && e.target.nodeName.toLowerCase() !== 'textarea') {
				that.keyPress(e);
				e.preventDefault();
			}
		});

		_.addEvent(document, 'keypress', function (e) {
			var code = e.keyCode || e.which;
			
			if(code >= 32 && code <= 126 && that.dcpu.isRunning && e.target.nodeName.toLowerCase() !== 'input' && e.target.nodeName.toLowerCase() !== 'textarea') {
				shift = false;
				that.keyPress(e);
				e.preventDefault();
			}
		});

		_.addEvent(document, 'keyup', function (e) {
			if(shift) {
				that.keyPress(e); // e = shift event
			}
		});
	};

})();
