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
			opTable: {
				'SET': 0x1,
				// sugar
				'MOV': 0x1,
				'ADD': 0x2,
				'SUB': 0x3,
				'MUL': 0x4,
				'MLI': 0x5,
				'DIV': 0x6,
				'DVI': 0x7,
				'MOD': 0x8,
				'MDI': 0x9,
				'AND': 0xa,
				'BOR': 0xb,
				'XOR': 0xc,
				'SHR': 0xd,
				'ASR': 0xe,
				'SHL': 0xf,

				'IFB': 0x10,
				'IFC': 0x11,
				'IFE': 0x12,
				'IFN': 0x13,
				'IFG': 0x14,
				'IFA': 0x15,
				'IFL': 0x16,
				'IFU': 0x17,
				
				'ADX': 0x1a,
				'SBX': 0x1b,
				
				'STI': 0x1e,
				'STD': 0x1f,
		
				// special instructions
				// TODO: get rid of the arithmetics
				'JSR': 0x1 << 5,
				
				'INT': 0x8 << 5,
				'IAG': 0x9 << 5,
				'IAS': 0xa << 5,
				'RFI': 0xb << 5,
				'IAQ': 0xc << 5,
				
				'HWN': 0x10 << 5,
				'HWQ': 0x11 << 5,
				'HWI': 0x12 << 5
			},
			
			regTable: {
				'A': 0x0,
				'B': 0x1,
				'C': 0x2,
				'X': 0x3,
				'Y': 0x4,
				'Z': 0x5,
				'I': 0x6,
				'J': 0x7,
				
				// pseudo registers
				'PUSH': 0x18,
				'POP': 0x18,
				'PEEK': 0x19,
				
				// special purpose registers
				'SP': 0x1b,
				'PC': 0x1c,
				'EX': 0x1d,
				'IA': 0xff
			},
			
			isArray: function (val) {
				return typeof val === "object" && 'splice' in val && 'join' in val;
			}
		}, // end of definition of _
		
		ParserError = function (msg, file, line) {
			this.name = 'ParserError';
			this.message = msg;
			this.line = line;
			this.file = file;
		};
		ParserError.prototype = Error.prototype;

	DCPU16.asm = function (src, options) {
		'use strict';
		
		var i, tokens, pc = 0, filepc = 0, oppc = 0, par = 0, tmp,
			filename, basePath = '', mapLines = [],
		
			// results
			bc = [], listing = [], rom = [],
			addr2line = {}, line2addr = {},
		
			// constrol structures
			labels = {}, macros = {},
			
			// second pass
			resolveLabels = [], resolveExpressions = [],
			
			// errors, warnings, ...
			warnings = [],
			warn = function (msg, line) {
				warnings.push({
					message: msg,
					file: mapLines[line - 1].file,
					line: mapLines[line - 1].line
				});
			},
			
			err = function (msg, line) {
				return new ParserError(msg, mapLines[line - 1].file, mapLines[line - 1].line);
			},
			
			// parsing and generating
			emit = function (value) {
				bc.push(value & DCPU16.maxWord);
				pc++;
				filepc++;
			},
			
			preprocess = function (src) {
				var i = 0, sub, incs = {}, files = [filename], file, fname = filename,
					counter = [0];

				src = src.split('\n');
				incs[filename] = src.length + 10;

				while (i < src.length) {
					sub = DCPU16.trim(src[i].split(';')[0]);
					if (sub.length > 0 && (sub.charAt(0) === '.' || sub.charAt(0) === '#') && sub.substr(1, 7) === 'include') {
						sub = DCPU16.trim(sub.substr(8));
						
						if (sub.charAt(0) === '"' || sub.charAt(sub.length - 1) === '"') {
							fname = basePath + DCPU16.separator + sub.slice(1, -1);

							if (incs[fname] >= 0) {
								src.splice(i, 1, '');
								warn('Ignoring "' + fname + '" because it was included more than once.', i - 1);
							} else {
								file = DCPU16.IO.read(fname).split('\n');
								incs[fname] = file.length;
								files.unshift(fname);
								src.splice.apply(src, [i, 1].concat(file));
								counter[0]++;
								counter.unshift(1);
							}
						} else {
							throw err('Not implemented: includes with parameters other than "<filename>".', i - 1);
						}
					} else {
						i++;
						incs[fname]--;
						
						if (incs[fname] > 0) {
							counter[0]++;
						} else {
							counter.shift();
							files.shift();
							fname = files[0];
							counter[0]++;
						}
					}

					mapLines.push({
						file: fname,
						line: counter[0]
					});
				}
				
				return src.join('\n');
			},

			parseTokens = function (node, allowMacros, evalExpressions) {
				var opcode = 0, parameters, i, j, result, tmp = [], parval;

				switch(node.type) {
				case "node_label":
					if (labels[node.value]) {
						j = mapLines[labels[node.value].line - 1];
						warn('Label "' + node.value + '" already defined in ' + j.file + ':' + j.line + ', ignoring this definition.', node.line);
					} else if (_.regTable[node.value.toUpperCase()] >= 0) {
						warn('"' + node.value + '" is a keyword. This label can not be referenced.', node.line);
					} else {
						labels[node.value] = {
							line: node.line,
							pc: pc
						};
					}
					break;
				case "node_directive":
					switch(node.value.toLowerCase()) {
					case "dat":
					case "dw":
						parameters = node.children[0];

						for (i = 0; i < parameters.length; i++) {
							tmp = parseTokens(parameters[i], false, false);

							if (_.isArray(tmp)) {
								emit(tmp[0]);
							} else if (typeof tmp === 'string'){
								for (j = 0; j < tmp.length; j++) {
									emit(tmp.charCodeAt(j));
								}
							} else {
								throw err('Unknown parameter "' + tmp + '" for dat.', node.line);
							}
						}
						break;

					case "org":
						pc = parseTokens(node.children[0][0], false, true)[0];
						break;
					// todo :/
					case "equ":
					case "eq":
					case "if":
					case "elseif":
					case "else":
					case "endif":
					case "macro":
					case "nolist":
					case "list":
					case "dir_callmacro":
						throw err('Not yet implemented.', node.line);
						break;
					default:
						warn('Ignoring unknown directive "' + node.value + '".', node.line);
						break;
					}
					break;
				case "node_op":
					if (_.opTable[node.value] >= 0) {
						opcode = _.opTable[node.value];
						parameters = node.children[0];
						
						// this is an issue in the parser that needs to be resolved there
						if (parameters.length === 1 && parameters[0] === '') {
							parameters.length = 0;
						}

						if (((opcode & 0x1f) > 0 && parameters.length !== 2) || ((opcode & 0x1f) === 0 && node.value !== 'RFI' && parameters.length !== 1)) {
							throw err('Invalid number of parameters. Got ' + parameters.length, node.line);
						}

						oppc = filepc;
						emit(0);

						if ((opcode & 0x1f) > 0) {
							// basic op
							for (par = 1; par >= 0; par--) {
								tmp = parseTokens(parameters[par], false, false);
								parval = 0;

								if (parameters[par].value === 'val_deref') {
									if (tmp[1] !== 0) {
										parval = _.regTable[tmp[1]];
										if (parval < 0x8) {
											parval += 0x8;
										}
									} else {
										parval = 0x1e;
										emit(tmp[0]);
									}
								} else {
									if (tmp[1] !== 0) {
										if (par === 1 && tmp[1] === 'PUSH') {
											throw err('PUSH is not allowed in this context.', node.line);
										} else if (par === 0 && tmp[1] === 'POP') {
											throw err('POP is not allowed in this context.', node.line);
										}
										
										parval = _.regTable[tmp[1]];
									} else {
										if (par === 1 && tmp[0] >= -1 && tmp[0] < 0x1f) {
											parval = 0x21 + tmp[0];
										} else if (par === 1 && tmp[0] === 0xffff) {
											parval = 0x20;
										} else {
											parval = 0x1f;
											emit(tmp[0]);
										}
									}
								}
								// write parameter value to opcode
								opcode |= ((parval & ((1 << (5 + par)) - 1)) << (5 + par * 5));
							}
						} else if (node.value !== 'RFI') {
							// non basic op
							par = 1;

							tmp = parseTokens(parameters[0], false, false);
							parval = 0;

							if (parameters[0].value === 'val_deref') {
								if (tmp[1] !== 0) {
									parval = _.regTable[tmp[1]];
									if (parval < 0x8) {
										parval += 0x8;
									}
								} else {
									parval = 0x1e;
									emit(tmp[0]);
								}
							} else {
								if (tmp[1] !== 0) {
									parval = _.regTable[tmp[1]];
								} else {
									if (par === 1 && tmp[0] > -1 && tmp[0] < 30) {
										parval = 0x21 + tmp[0];
									} else {
										parval = 0x1f;
										emit(tmp[0]);
									}
								}
							}
							// write parameter value to opcode
							opcode |= ((parval & 0x3f) << 10);
						}
						
						bc[oppc] = opcode;
					} else {
						throw err('Unknown mnemonic "' + node.value + '".', node.line);
					}
					break;
				case "node_value":
					switch (node.value) {
					case "val_paramlist":
						result = [];
						for (i = 0; i < node.children.length; i++) {
							result.push(parseTokens(node.children[i], false, evalExpressions));
						}
						break;
					case "val_deref":
						result = parseTokens(node.children[0], false, evalExpressions);
						break;
					case "val_literal":
						result = parseTokens(node.children[0], false, evalExpressions);
						break;
					}
					break;
				case "val_register":
					result = [0, node.value];
					break;
				case "val_identifier":
					if (evalExpressions) {
						result = [labels[node.value].pc, 0];
					} else {
						resolveLabels.push({
							label: node.value,
							pc: filepc,
							par: par,
							line: node.line,
							oppc: oppc
						});
						result = [0xDEAD, 0];
					}
					break;
				case "val_number":
					result = [node.value, 0];
					break;
				case "val_string":
					if (evalExpressions) {
						result = [node.value.length > 0 ? node.value.charCodeAt(0) : 0, 0];
					} else {
						result = node.value;
					}
					break;
				case "node_comparison":
					throw err('Not implemented', node.line);
					break;
				case "node_expression":
					if (!evalExpressions) {
						resolveExpressions.push({
							expression: node,
							pc: filepc,
							par: par,
							line: node.line,
							oppc: oppc
						});
						result = [0xDEAD, 0];
					} else {
						tmp.push(parseTokens(node.children[0], false, true));
						
						if (node.children.length > 1) {
							tmp.push(parseTokens(node.children[1], false, true));
						}
						
						if (node.children.length > 1) {
							if (tmp[0][1] !== 0 && tmp[1][1] !== 0) {
								throw err('Found multiple registers in one expression.', node.line);
							}
						
							if ((tmp[0][1] !== 0 || tmp[1][1] !== 0) && node.value !== '+') {
								throw err('Registers inside expressions are allowed in sums only.', node.line);
							}
						} else {
							if ((tmp[0][1] !== 0) && node.value !== 'u+') {
								throw err('Registers inside expressions are allowed in sums only.', node.line);
							}
						}
						
						result = [0, 0];
						
						if (tmp[0][1] !== 0) {
							result[1] = tmp[0][1];
						}
						
						if (node.children.length > 1) {
							if (tmp[1][1] !== 0) {
								result[1] = tmp[1][1];
							}
						}

						switch (node.value) {
						case "+":
							result[0] = tmp[0][0] + tmp[1][0];
							break;
						case "-":
							result[0] = tmp[0][0] - tmp[1][0];
							break;
						case "*":
							result[0] = tmp[0][0] * tmp[1][0];
							break;
						case "/":
							result[0] = tmp[0][0] / tmp[1][0];
							break;
						case "%":
							result[0] = tmp[0][0] % tmp[1][0];
							break;
						case "&":
							result[0] = tmp[0][0] & tmp[1][0];
							break;
						case "|":
							result[0] = tmp[0][0] | tmp[1][0];
							break;
						case "^":
							result[0] = tmp[0][0] ^ tmp[1][0];
							break;
						case "<<":
							result[0] = tmp[0][0] << tmp[1][0];
							break;
						case ">>":
							result[0] = tmp[0][0] >> tmp[1][0];
							break;
						case "u~":
							result[0] = ~tmp[0][0];
							break;
						case "u+":
							result[0] = tmp[0][0];
							break;
						case "u-":
							result[0] = -tmp[0][0];
							break;
						}
					}
					break;
				}
				
				return result;
			};
	
		options = options || {};
		
		if (options.fromFile) {
			filename = src;
			src = DCPU16.IO.read(filename);
			
			basePath = [];
			filename = filename.split(DCPU16.separator);
			
			for (i = 0; i < filename.length - 1; i++) {
				basePath.push(filename[i]);
			}
			
			basePath = basePath.join(DCPU16.separator);
			filename = filename.join(DCPU16.separator);
		} else {
			filename = 'default';
		}

		src = preprocess(src);
		
		if (options.include) {
			return src;
		}
		
		pc = options.base || 0;

		try {
			tokens = DCPU16.Parser.parse(src);

			for (i = 0; i < tokens.length; i++) {
				// assuming we have a single file only
				if (tokens[i].value !== 'nop') {
					addr2line[pc] = tokens[i].line;
					line2addr[tokens[i].line] = pc;
				}
				parseTokens(tokens[i], true, false);
			}
		} catch (e) {
			//console.log(e, e.stack);
			// rethrow e
			throw e;
		}
		
		// labels and expressions
		for (i = 0; i < resolveLabels.length; i++) {
			tmp = resolveLabels[i];
			
			if (typeof labels[tmp.label] !== 'undefined') {
				bc[tmp.pc] = labels[tmp.label].pc;
			} else {
				throw new ParserError('Can\'t find definition for label "' + tmp.label + '"', filename, tmp.line);
			}
		}
		
		for (i = 0; i < resolveExpressions.length; i++) {
			tmp = resolveExpressions[i];

			par = parseTokens(tmp.expression, false, true);
			if (par[1] !== 0) {
				// we have a register in here
				oppc = par[1];
				par[1] = _.regTable[par[1]];
				
				// we have to delete the old parameter value
				bc[tmp.oppc] &= (((1 << (5 + (1 - tmp.par))) - 1) << (5 + (1 - tmp.par) * 5)) | 0x1f;

				if (par[1] >= 0 && par[1] < 0x8) {
					// it's a standard register
					bc[tmp.oppc] |= (par[1] + 0x10) << (5 + tmp.par * 5);
				} else if (par[1] === 0x1b) {
					// it's SP
					bc[tmp.oppc] |= 0x1a << (5 + tmp.par * 5);
				} else {
					throw new ParserError('The register "' + oppc + '" is not allowed in an expression.', filename, tmp.line);
				}
			}

			bc[tmp.pc] = par[0];
		}

		for (i = 0; i < bc.length; i++) {
			rom.push(bc[i] & 0xff);
			rom.push((bc[i] >> 8) & 0xff);
		}
		
		return {
			bc: rom,
			base: 0,
			warnings: warnings,
			addr2line: addr2line,
			line2addr: line2addr,
			labels: labels,
			entry: addr2line[0]
		};
	}
	
	if (typeof TestCase !== 'undefined') {
		DCPU16.ParserError = ParserError;
	}

})();
