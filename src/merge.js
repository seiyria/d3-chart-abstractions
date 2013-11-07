
var Merge = (function(){

	var self = this;

	self.CopyLeft = function(left, right) {
		var ret = JSON.parse(JSON.stringify(left));

		for(var property in left) {
			if(right.hasOwnProperty(property)) {
				if(typeof left[property] === "object")
					ret[property] = self.CopyLeft(left[property], right[property]);
				else
					ret[property] = right[property];
			}
		}

		return ret;
	};

	self.BarMerge = function(left, right) {
		var merged = self.CopyLeft(left, right);

		merged.layout.width = merged.layout.width - merged.layout.margin.left - merged.layout.margin.right;
		merged.layout.height = merged.layout.height - merged.layout.margin.top - merged.layout.margin.bottom;

		//assign global formatting if necessary
		var formattingObjects = [
			merged.display.labels.aggregate,
			merged.display.labels.tooltip,
			merged.display.labels.legend,
			merged.display.labels.axes,
			merged.display.labels.bars,
			merged.display.labels.x,
			merged.display.labels.y
		];

		merged.display.labels.tooltip.formatting = merged.display.labels.tooltip.formatting || merged.display.labels.bars.formatting;

		formattingObjects.forEach(function(e, i) {
			e.formatting = e.formatting || merged.formatting;

			if(typeof e.formatting.numFormat !== "function")
				e.formatting.numFormat = d3.format(e.formatting.numFormat);
		});
		
		//do the same thing as the formatting objects
		var fontObjects = [
			merged.display.labels.aggregate,
			merged.display.labels.tooltip,
			merged.display.labels.legend,
			merged.display.labels.axes,
			merged.display.labels.bars,
			merged.display.labels.x,
			merged.display.labels.y
		];

		fontObjects.forEach(function(e, i) {
			e.font = e.font || merged.font;
		});

		return merged;
	};

	return this;
})();

root = typeof exports !== "undefined" && exports !== null ? exports : window;
root.Merge = Merge;