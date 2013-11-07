
var assert = require('assert');

var merger = require('../src/merge.js').Merge;


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
});