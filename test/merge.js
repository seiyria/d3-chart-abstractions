
var assert = require('assert');

var merger = require('../src/merge.js').Merge;
var bargraph = require('../dist/development/bar.js').BarGraph;

describe('Merge', function() {
	describe('Flat Merge', function() {

		var baseObj = {
			test: 3,
			property: "value"
		};

		var intoObj = {
			test: 1,
			notPresent: "hey!"
		};

		var merged = merger.CopyLeft(baseObj, intoObj);

		it('should merge over values in left', function() {
			assert.equal(merged.test, 1);
		});

		it('should not overwrite untouched values in left', function() {
			assert.equal(merged.property, "value");
		});

		it('should not copy values that are not in the base object', function() {
			assert.equal(merged.notPresent, undefined);
		});
	});

	describe('Recursive Merge', function() {

		var baseObj = {
			obj: {
				prop: 1,
				untouched: 2,
				nestObj: {
					prop: 2
				},
				undef: undefined
			}
		};

		var intoObj = {
			obj: {
				prop: 7,
				heyo: "heyo!",
				nestObj: {
					prop: 9
				},
				undef: {
					val: true
				}
			}
		};

		var merged = merger.CopyLeft(baseObj, intoObj);

		it('should recursively copy values defined in the left object', function() {
			assert.equal(merged.obj.prop, 7);
		});

		it('should take object values verbatim if an object is supplied in right and not left', function() {
			assert.equal(typeof merged.obj.undef, "object");
			assert.equal(merged.obj.undef.val, true);
		});

		it('should recursively copy values defined in a sub object', function() {
			assert.equal(merged.obj.nestObj.prop, 9);
		});

		it('should ignore values that are not defined in left', function() {
			assert.equal(merged.obj.heyo, undefined);
		});

		it('should not touch values that are in a nested object in both sides', function() {
			assert.equal(merged.obj.untouched, 2);
		});
	});

	describe('Bar Graph Merging', function() {

		var defaults = bargraph.prototype.defaults;

		it('should have a correctly calculated width (width-margin.left-margin.right)', function() {
			var custom = {
				layout: {
					margin: {
						top:    20,
						bottom: 40,
						left:   50,
						right:  60
					},
					width:      960,
					height:     500
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.layout.width, 850);
		});

		it('should have a correctly calculated height (height-margin.top-margin.bottom)', function() {
			var custom = {
				layout: {
					margin: {
						top:    20,
						bottom: 40,
						left:   50,
						right:  60
					},
					width:      960,
					height:     500
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.layout.height, 440);
		});

		it('should use the default formatting when none is supplied', function() {

			var merged = merger.BarMerge(defaults, {});

			assert.equal(merged.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.aggregate.formatting.strFormat, "%n");

			assert.equal(merged.display.labels.tooltip.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.legend.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.axes.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.bars.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.x.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.y.formatting.strFormat, "%n");
		});

		it('should use a global formatting when no custom formatting is supplied', function() {

			var custom = {
				formatting: {
					strFormat: "+%n"
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.aggregate.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.tooltip.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.legend.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.axes.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.bars.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.x.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.y.formatting.strFormat, "+%n");

		});

		it('should use the custom formatting supplied instead of the global formatting', function() {

			var custom = {
				formatting: {
					strFormat: "+%n"
				},

				display: {
					labels: {
						aggregate: {
							formatting: {
								numFormat: '',
								strFormat: '++%n'
							}
						}
					}
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.aggregate.formatting.strFormat, "++%n");

			assert.equal(merged.display.labels.tooltip.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.legend.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.axes.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.bars.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.x.formatting.strFormat, "+%n");
			assert.equal(merged.display.labels.y.formatting.strFormat, "+%n");

		});

		it('should use the default font when none is supplied', function() {

			var merged = merger.BarMerge(defaults, {});

			assert.equal(merged.font.face, "sans-serif");
			assert.equal(merged.display.labels.aggregate.font.face, "sans-serif");

			assert.equal(merged.display.labels.tooltip.font.face, "sans-serif");
			assert.equal(merged.display.labels.legend.font.face, "sans-serif");
			assert.equal(merged.display.labels.axes.font.face, "sans-serif");
			assert.equal(merged.display.labels.bars.font.face, "sans-serif");
			assert.equal(merged.display.labels.x.font.face, "sans-serif");
			assert.equal(merged.display.labels.y.font.face, "sans-serif");
		});

		it('should use the global font when there are overridden properties', function() {

			var custom = {
				font: {
					face: "Times"
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.font.face, "Times");
			assert.equal(merged.display.labels.aggregate.font.face, "Times");

			assert.equal(merged.display.labels.tooltip.font.face, "Times");
			assert.equal(merged.display.labels.legend.font.face, "Times");
			assert.equal(merged.display.labels.axes.font.face, "Times");
			assert.equal(merged.display.labels.bars.font.face, "Times");
			assert.equal(merged.display.labels.x.font.face, "Times");
			assert.equal(merged.display.labels.y.font.face, "Times");
		});

		it('should use a custom font instead of the global font when specified', function() {

			var custom = {
				font: {
					face: "Times"
				},

				display: {
					labels: {
						aggregate: {
							font: {
								face: "Courier"
							}
						}
					}
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.font.face, "Times");
			assert.equal(merged.display.labels.aggregate.font.face, "Courier");

			assert.equal(merged.display.labels.tooltip.font.face, "Times");
			assert.equal(merged.display.labels.legend.font.face, "Times");
			assert.equal(merged.display.labels.axes.font.face, "Times");
			assert.equal(merged.display.labels.bars.font.face, "Times");
			assert.equal(merged.display.labels.x.font.face, "Times");
			assert.equal(merged.display.labels.y.font.face, "Times");
		});

		it('should copy the bar formatting to the tooltip formatting when no tooltip formatting is supplied', function() {

			var merged = merger.BarMerge(defaults, {});

			assert.equal(merged.display.labels.tooltip.formatting.strFormat, "%n");
			assert.equal(merged.display.labels.bars.formatting.strFormat, "%n");
		});

		it('should copy custom bar formatting to the tooltip formatting when no tooltip formatting is supplied', function() {
			var custom = {
				display: {
					labels: {
						bars: {
							formatting: {
								numFormat: '',
								strFormat: '++%n'
							}
						}
					}
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.display.labels.tooltip.formatting.strFormat, "++%n");
			assert.equal(merged.display.labels.bars.formatting.strFormat, "++%n");
		});

		it('should not copy any formatting to the tooltip formatting when it is supplied', function() {
			var custom = {
				display: {
					labels: {
						bars: {
							formatting: {
								numFormat: '',
								strFormat: '+%n'
							}
						},
						tooltip: {
							formatting: {
								numFormat: '',
								strFormat: '++%n'
							}
						}
					}
				}
			};

			var merged = merger.BarMerge(defaults, custom);

			assert.equal(merged.display.labels.tooltip.formatting.strFormat, "++%n");
			assert.equal(merged.display.labels.bars.formatting.strFormat, "+%n");
		});
	});
});