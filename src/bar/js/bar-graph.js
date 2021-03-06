
var BarGraph = function(opts) {

	//merge the objects, taking only the data from opts
	var merged = Merge.BarMerge(this.defaults, opts);

	//this is the only data that needs to be accessible while rendering, since the rest was computed
	this.layout = merged.layout;
	this.data = merged.data;
	this.display = merged.display;

	//generating data points - we need to know how much to generate
	//every data set needs to be symmetric - I do not zero-fill missing data.
	var barCount = this.data.graph[0].data.length;
	var layerCount = Object.keys(this.data.graph).length;

	//easy referencing in nested functions
	var self = this;

	//change between a group and a stack graph
	var change = function() {
		if(self.layout.graph.style == "group")
			self.stackTransition(false);
		else
			self.groupTransition(false);
	};

	//calculate totals for data points
	var totals = (function(){

		var ret = [];

		for(var dataCategory in self.data.graph) {
			var categoryData = self.data.graph[dataCategory];
			categoryData.total = 0;
			for(var dataPiece in categoryData.data) {
				var dataValue = categoryData.data[dataPiece];
				categoryData.total += dataValue.value;
			}
			ret.push({name: categoryData.name, value: categoryData.total});
		}

		return ret;
	})();

	//get the initial data points on the map
	var setupDataPoints = function(dataIndex) {

		var array = [];
		var layerCount = [];
		for(var dataCategory in self.data.graph) {
			var categoryData = self.data.graph[dataCategory];
			array = array.concat(categoryData.data[dataIndex]);
			layerCount.push(categoryData);
		}

		var isBarVisible = function(element) {
			if(element.hidden) return false;
			return self.display.labels.bars.hideThreshold === 0 ? 
				true : 
				element.value > self.display.labels.bars.hideThreshold; 
		};

		//generate a bunch of data objects for our data
		var labels = array.map(function(element, idx) {

			var formatValue = function(element) {
				return  self.layout.graph.type === "percent"
							? Math.max(0, (element.value/layerCount[idx].total)*100)
							: element.value;
			};  

			var barValue = formatValue(element);

			return {
				id: element.name + (self.currentItem++),
				name: element.name,
				parent: layerCount[idx].name,
				dispValue: isBarVisible(barValue) ? barValue: 0, 
				x: idx, 
				y: isBarVisible(element) ? (self.layout.graph.type == "percent" ?
					Math.max(0, (element.value/layerCount[idx].total)*100) :
					element.value) : 0
			}; 
		});

		return labels;
	};

	var _totalLabels;

	//the labels for totals need to be created separately
	var totalLabels = function() {
		if(_totalLabels) return _totalLabels;
		var aggregates = [];
		if(self.display.labels.aggregate.show) {
			aggregates = totals.map(function(element, idx) {
				return {
					id: "agg" + (self.currentItem++),
					isAggregate: true,
					name: element.name,
					dispValue: element.value, 
					x: idx, 
					y: element.value,
					y0: element.value
				}; 
			});
		}
		_totalLabels = aggregates;
		return aggregates;
	};

	//all of the d3 variables for the svg are shown here
	var xAxis;
	var yAxis;
	var xScale;
	var yScale;
	var stack = d3.layout.stack();
	var layerData = d3.range(barCount).map(function(v, idx) { return setupDataPoints(idx); });
	var layers = stack(layerData);
	var yGroupMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y; }); });
	var yStackMax = d3.max(layers, function(layer) { return d3.max(layer, function(d) { return d.y0 + d.y; }); });

	//add a little room for the graph to show labels and have a max height
	if(self.layout.graph.type == "value")
		yStackMax = yStackMax + Math.floor(yStackMax/10);

	var rect;
	var text;
	var aggregateLabels;
	var svgElement;

	//this is the tooltip, formatted nicely.
	var tip = d3.tip().attr('class', 'd3-tip').html(function(d) { 
		return self.display.labels.tooltip.formatting.strFormat
					.split("%n").join(self.display.labels.tooltip.formatting.numFormat(d.dispValue));
	});
	
	tip.offset([-5, 0]);

	//where does the text go for our specific text alignment?
	var textPositionCalc = function() {
		var base = {
			x: function(d, i, j) { 
				var ret = xScale(d.x);

				if(self.layout.graph.style == "stack") {
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand()) / 2;

				} else {
					ret += self.layout.graph.bars.spacing / 4;
					ret += xScale.rangeBand() / barCount * j;
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand() / barCount) / 2;
				}

				return ret - d.compLen/2;
			},
			y: function(d) { 
				var ret = d.compHeight/3;
				if(self.layout.graph.style == "stack")
					if(d.isAggregate) 
						ret += yScale(d.y0);
					else
						ret += yScale(d.y0 + d.y/2);
				else 
					ret += yScale(d.y/2);
				return ret;
			},
			height: function(d) { 
				if(self.layout.graph.style == "stack")
					return yScale(d.y0) - yScale(d.y0 + d.y);
				else
					return self.layout.height - yScale(d.y);
			},
			width: function(d) { 
				if(self.layout.graph.style == "stack") 
					return xScale.rangeBand();
				else 
					return ((self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand() / barCount) ) / 2;
				
			}
		};
		var left = {
			x: function(d, i, j) { 
				var ret = base.x(d, i, j);

				if(self.layout.graph.style == "stack"){
					ret -= (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand()) / 2;
				} else {
					ret -= (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand() / barCount) / 2;
				}
				ret += d.compLen/2;

				return ret;
			},
			y: function(d) { return base.y(d); },
			height: function(d) { return base.height(d); },
			width: function(d) { return base.width(d); }
		};
		var right = {
			x: function(d, i, j) { 
				var ret = base.x(d, i, j);

				if(self.layout.graph.style == "stack"){
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand()) / 2;
				} else {
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand() / barCount) / 2;
				}
				
				ret -= d.compLen/2;

				return ret;
			},
			y: function(d) { return base.y(d); },
			height: function(d) { return base.height(d); },
			width: function(d) { return base.width(d); }
		};
		var top = {
			x: function(d, i, j) { return base.x(d, i, j); },
			y: function(d) { 
				var ret = 0;

				if(self.layout.graph.style == "stack")
					ret += yScale(d.y0 + d.y);
				else 
					ret += yScale(d.y);

				ret += d.compHeight;

				return ret; 
			},
			height: function(d) { return base.height(d); },
			width: function(d) { return base.width(d); }
		};
		var bottom = {
			x: function(d, i, j) { return base.x(d, i, j); },
			y: function(d) { 
				var ret = 0;

				if(self.layout.graph.style == "stack")
					ret += yScale(d.y0);
				else 
					ret += yScale(0);

				ret -= d.compHeight/4;

				return ret; 
			},
			height: function(d) { return base.height(d); },
			width: function(d) { return base.width(d); }
		};

		switch(self.display.labels.bars.font.align) {
			case "center": 
				return base;
			case "left":
				return left;
			case "right":
				return right;
			case "top":
				return top;
			case "bottom":
				return bottom;
			default: 
				console.error("invalid formatting.bars.textalign "+self.display.labels.bars.font.align);
		}
	};
	
	self.redraw = function() {

		//where should the legend go in the overall svg?
		var legendPosition = function() {
			switch(self.layout.legend.compass) {
				case 'left': 
					return {
						x: -self.layout.width-self.layout.padding-self.layout.margin.left, 
						y: self.layout.height/2 - self.layout.legend.height/2,
						offsetX: self.layout.legend.width,
						offsetY: 0
					};
				case 'right': 
					return {
						x: -self.layout.margin.right,
						y: self.layout.height/2 - self.layout.legend.height/2,
						offsetX: 0,
						offsetY: 0
					};
				case 'bottom': 
					return {
						x: self.layout.width/2 - self.layout.legend.width/2,
						y: self.layout.margin.bottom/2 + self.layout.legend.height/2,
						offsetX: 0,
						offsetY: 0
					};
				case 'top': 
					return {
						x: self.layout.width/2 - self.layout.legend.width/2,
						y: -self.layout.height - self.layout.legend.height/2,
						offsetX: 0,
						offsetY: 0
					};
				default: console.error('invalid legend position '+self.layout.legend.compass);
			}
				 
		};

		//figure out the overall boundaries on the svg
		var calculateBounds = function() {
			var ret = {
				width: self.layout.width + self.layout.margin.left + self.layout.margin.right,
				height: self.layout.height + self.layout.margin.top + self.layout.margin.bottom + self.layout.padding,
				offsetX: self.layout.margin.left,
				offsetY: self.layout.margin.top
			};

			switch(self.layout.legend.compass) {
				case 'left':
					ret.offsetX += self.layout.legend.width;
					break;
				case 'bottom': 
					ret.offsetY += self.layout.legend.height/2;
			}
			return ret;
		};

		//create all the d3 variables
		xScale = d3.scale.ordinal()
			.domain(d3.range(layerCount))
			.rangeRoundBands([0, self.layout.width], 0.08);

		yScale = d3.scale.linear()
			.domain([0, yStackMax])
			.range([self.layout.height, 0]);

		xAxis = d3.svg.axis()
			.scale(xScale)
			.tickSize(0)
			.tickPadding(self.display.grid.tickPadding)
			.orient("bottom");

		yAxis = d3.svg.axis()
			.scale(yScale)
			.orient("left")
			.tickSize((self.display.grid.lines.indexOf("horiz") !== -1 ? -self.layout.width : 0), 0, 0)
			.tickPadding(self.display.grid.tickPadding)
			.ticks(self.display.grid.tickCount);

		//lets start making that svg now...
		var svg = (function setupGraph() {

			var bounds = calculateBounds();

			//we don't want to re-create the svg if we're just redrawing it.
			if(svgElement) {
				d3.select("svg").remove();
			}

			svgElement = d3.select(self.display.target).append("svg")
				.attr("width", bounds.width)
				.attr("height", bounds.height)
				.attr("class", "graph-vertical")
			.append("g")
				.attr("transform", "translate(" + bounds.offsetX + "," + bounds.offsetY + ")");

			svgElement.append("g")         
				.attr("class", "grid")
				.call(yAxis);

			svgElement.append("g")
				.attr("class", "y axis")
				.attr("stroke-width", "0")
				.attr("transform", "translate(20,0)")
				.call(yAxis);

			svgElement.append("g")
				.attr("class", "x axis")
				.attr("transform", "translate(0," + self.layout.height + ")")
				.call(xAxis);

			svgElement.append("g")
				.attr("class", "legend container")
				.append("rect")
					.attr("class", "x label legend")
					.style("fill", "#cac")
					.style("stroke", "#000")
					.style("stroke-width", "1px")
					.attr("x", self.layout.width/2)
					.attr("y", self.layout.height+self.layout.padding)
				.call(xAxis);

			svgElement.append("text")
				.attr("class", "y label")
				.attr("text-anchor", "end")
				.attr("y", -20)
				.attr("x", -self.layout.height/2)
				.attr("dy", ".75em")
				.attr("transform", "rotate(-90)")
				.style("font-family", self.display.labels.y.font.face)
				.style("font-size", self.display.labels.y.font.size)
				.style("font-weight", self.display.labels.y.font.weight)
				.style("font-style", self.display.labels.y.font.style)
				.text(self.display.labels.y.text);

			svgElement.append("text")
				.attr("class", "x label")
				.attr("text-anchor", "end")
				.attr("x", self.layout.width/2)
				.attr("y", self.layout.height + 20)
				.attr("dy", ".75em")
				.style("font-family", self.display.labels.x.font.face)
				.style("font-size", self.display.labels.x.font.size)
				.style("font-weight", self.display.labels.x.font.weight)
				.style("font-style", self.display.labels.x.font.style)
				.text(self.display.labels.x.text);

			svgElement
				.append("foreignObject")
					.attr("width", 32)
					.attr("height", 32)
					.attr("x", self.layout.width - self.layout.padding)
					.attr("y", 0)
					.attr("class", "swap-icon")
					.on("mousedown", change)
				.append("xhtml:body")
					.html("<i class='fa fa-tasks'></i>");

			svgElement.call(tip);

			return svgElement;
		})();

		//all taken from the legend, and added to the svg definitions
		var setupGradients = (function() {
			var defs = svg.append("svg:defs");

			for(var style in self.data.legend) {
				var styleData = self.data.legend[style];
				var gradient = defs.append("svg:linearGradient")
					.attr("id", "gradient-"+styleData.name)
					.attr("x1", "50%")
					.attr("y1", "0%")
					.attr("x2", "50%")
					.attr("y2", "100%");

				gradient.append("svg:stop")
					.attr("offset", "1%")
					.attr("stop-color", "#fff");

				gradient.append("svg:stop")
					.attr("offset", "100%")
					.attr("stop-color", styleData.color);
			}
		})();

		//creating and drawing the initial layers
		var layer = svg.selectAll(".layer").data(layers)
			.enter().append("g")
				.attr("class", "layer")

				.style("fill", function chooseColorPattern(d, i) { 
					return self.isGradient ?
						"url(#gradient-"+self.data.legend[i].name+")" :
						self.data.legend[i].color;
				});

		var rectBase = layer.selectAll("rect")
			.data(function(d) { return d; });

		//all of the rectangles (bars) on the graph
		rect = (function() {
			return rectBase.enter().append("rect")
				.attr("class", "bar")

				.on('mouseover', tip.show)
				.on('mouseout', tip.hide)
				.on('mousedown', function(d) { console.debug(d.parent + " " + d.dispValue); })
				//outlines
				.style("stroke", "#000")
				.style("stroke-width", "1px");
		})();

		//all of the text labels, minus the aggregate ones
		text = (function() {

			var totals = {};

			var innerText = rectBase.enter()
				.append("text")
					.text(function(d) { 
						return (d.dispValue === 0 || !self.display.labels.bars.show) ? "" : 
							self.display.labels.bars.formatting.strFormat
								.split("%n").join(self.display.labels.bars.formatting.numFormat(d.dispValue)); 
						})
					.attr("width", self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand())
					.attr("class", function(d) { return "rectInner " + d.id; })
					.style("pointer-events", "none")
					.style("font-family", self.display.labels.bars.font.face)
					.style("font-size", self.display.labels.bars.font.size)
					.style("font-weight", self.display.labels.bars.font.weight)
					.style("font-style", self.display.labels.bars.font.style)
					.style("fill", "#000");

			//after drawing them, compute their size
			innerText.each(function() {
				var el = d3.select(this);
				var length = this.getBBox().width;
				var height = this.getBBox().height;

				el.attr("x", function setupBBoxVars(d) { 
					d.compLen = length; 
					d.compHeight = height; 
					return el.attr("x"); 
				});
			});

			return innerText;
		})();

		//draw aggregate labels if necessary
		if(self.display.labels.aggregate.show) {
			aggregateLabels = (function(){ 
				var labels = totalLabels();

				d3.range(layerCount).map(function(d, idx) {
					svgElement.append("text")
						.text(labels[idx].dispValue)
						.attr("class", "rectInner aggregate")
						.style("font-family", self.display.labels.bars.font.face)
						.style("font-size", self.display.labels.bars.font.size)
						.style("font-weight", self.display.labels.bars.font.weight)
						.style("font-style", self.display.labels.bars.font.style)
						.style("fill", "#000");
				});

				var retVal = svgElement.selectAll(".aggregate");

				retVal.each(function(d, idx) {
					var el = d3.select(this);
					var length = this.getBBox().width;
					var height = this.getBBox().height;
					labels[idx].compLen = length; 
					labels[idx].compHeight = height; 
				});

				return retVal;
			})();
		}

		//draw and place the legend
		var legend = (function() {

			var xFunction = function(bool) {
				var padding = bool ? 13 : 0;
				switch(self.layout.legend.compass) {
					case 'right': 
						return function() { return self.layout.width + self.layout.margin.right + padding; };
					case 'left': 
						return function() { return self.layout.width + self.layout.margin.left + padding; };
					case 'bottom':
					case 'top':
						return function(d, i) { return i * 30 + padding; };
				}
			};

			var yFunction = function(bool) {
				var padding = bool ? 8 : 0;
				switch(self.layout.legend.compass) {
					case 'right': 
					case 'left': 
						return function(d, i){ return (i * 20) + padding; };
					case 'bottom':
					case 'top':
						return function(){ return self.layout.height + padding; };
				}
			};

			var legendG = svg.append("g")
				.attr("class", "legend")
				.attr("height", self.layout.legend.height)
				.attr("width", self.layout.legend.width);

			legendG.selectAll('rect')
				.data(self.data.legend)
				.enter()
					.append("rect")
					.attr("x", xFunction())
					.attr("y", yFunction())
					.attr("width", 10)
					.attr("height", 10)
					.on('mousedown', function(d) { console.debug(d); })
					.style("fill", function(d) { 
						return d.color;
					});

			legendG.selectAll('text')
				.data(self.data.legend)
				.enter()
					.append("text")
					.attr("x", xFunction(true))
					.attr("y", yFunction(true))
					.style("font-family", self.display.labels.legend.font.face)
					.style("font-size", self.display.labels.legend.font.size)
					.style("font-weight", self.display.labels.legend.font.weight)
					.style("font-style", self.display.labels.legend.font.style)
					.text(function(d) {
						return d.name;
					});
			
			var elCount = 0;
			var maxWidth = 0;

			//TODO auto calc some bounding box junk

			legendG.each(function() {
				elCount++;
				var width = this.getBBox().width;
				if(width > maxWidth) maxWidth = width;
				var el = d3.select(this);
				el.attr("x", parseInt(el.attr("x"))+10);
			});

			self.layout.legend.width = maxWidth * elCount;

			var legendPos = legendPosition();

			legendG.attr('transform', 'translate('+(legendPos.x-legendPos.offsetX)+','+(legendPos.y-legendPos.offsetY)+')');

			return legendG;
		})();   
		
	};
	
	//some finishing remarks for the svg
	var cleanup = function() {

		//change the axis text
		svgElement.selectAll(".x.axis .tick text")
			.text(function(x) { return self.data.graph[x].name; });

		//change the axis font
		svgElement.selectAll(".axis .tick text")
			.style("font-family", self.display.labels.bars.font.face)
			.style("font-size", self.display.labels.bars.font.size)
			.style("font-weight", self.display.labels.bars.font.weight)
			.style("font-style", self.display.labels.bars.font.style);

		//hide the old axis ticks
		svgElement.selectAll(".grid .tick text").style("display","none");

		//realign all text as necessary
		svgElement.selectAll(".label").each(function() {

			//x and y are swapped because it's transformed
			var el = d3.select(this);

			//prevent re-centering
			if(el.attr("data-centered") !== "true") { 
				var height = this.getBBox().width;
				var newx = parseInt(el.attr("x")) + height/2;
				el.attr("x", newx);
				el.attr("data-centered","true");
			}
		});
	};

	//perform a transition to the grouped state
	self.groupTransition = function transitionGrouped(instant) {

		self.layout.graph.style="group";
		var textPosition = textPositionCalc();

		//magic numbers!
		var max = yGroupMax*2.5;

		if(self.layout.type == 'percent')
			max *= 2/3;

		yScale.domain([0, max]);

		rect.transition()
			.duration(instant ? 0 : 500)
			.delay(function(d, i) { return instant ? 0 : i * 10; })
				.attr("x", function(d, i, j) { 
					return xScale(d.x) + self.layout.graph.bars.spacing/2 + 
						xScale.rangeBand() / barCount * j; 
					})
				.attr("width", (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand() / barCount) 
					- self.layout.graph.bars.spacing/2)
			.transition()
				.duration(instant ? 0 : 250)
				.attr("y", function(d) { return yScale(d.y); })
				.attr("height", function(d) { return self.layout.height - yScale(d.y); });


		text
			.transition()
				.duration(instant ? 0 : 500)
				.delay(function(d, i) { return instant ? 0 : i * 10; })
					.attr("x", textPosition.x)
					.attr("width", textPosition.width)
			.transition()
				.duration(instant ? 0 : 250)
				.attr("y", textPosition.y)
				.attr("height", textPosition.height)
				.each("end", function(d) {

					var me = d3.select(this);
					var text = svgElement.select("."+d.id);
					var myHeight = me.attr("height");

					if(self.display.labels.bars.hideSmallValueLabels && myHeight <= d.compHeight) {
						text.style("visibility", "hidden");
					} else {
						text.style("visibility", "visible");
					}
				});

		if(self.display.labels.aggregate.show) {
			aggregateLabels
				.transition()
					.duration(instant ? 0 : 500)
					.delay(function(d, i) { return instant ? 0 : i * 10; })
						.attr("opacity", 0);
		}

		cleanup();
	};

	//transition to a stacked graph
	self.stackTransition = function transitionStacked(instant) {

		self.layout.graph.style="stack";
		var textPosition = textPositionCalc();

		yScale.domain([0, yStackMax]);

		rect.transition()
			.duration(instant ? 0 : 500)
			.delay(function(d, i) { return instant ? 0 : i * 10; })
				.attr("y", function(d) { return yScale(d.y0 + d.y); })
				.attr("height", function(d) { return yScale(d.y0) - yScale(d.y0 + d.y); })
			.transition()
				.duration(instant ? 0 : 250)
				.attr("x", function(d) { return xScale(d.x); })
				.attr("width", self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand());

		text
			.transition()
				.duration(instant ? 0 : 500)
				.delay(function(d, i) { return instant ? 0 : i * 10; })
					.attr("y",  textPosition.y)
					.attr("height", textPosition.height)
			.transition()
				.duration(instant ? 0 : 250)
				.attr("x", textPosition.x)
				.attr("width", textPosition.width)
				.each("end", function(d) {

					var me = d3.select(this);
					var text = svgElement.select("."+d.id);
					var myHeight = me.attr("height");

					if(self.display.labels.bars.hideSmallValueLabels && myHeight <= d.compHeight) {
						text.style("visibility", "hidden");
					} else {
						text.style("visibility", "visible");
					}
				});

		if(self.display.labels.aggregate.show) {
			var labels = totalLabels();

			aggregateLabels
				.transition()
					.duration(instant ? 0 : 500)
					.delay(function(d, i) { return instant ? 0 : i * 10; })
						.attr("opacity", 1)
						.attr("y", function(d, i, j) { 
							return textPosition.y(labels[i], i, j) - labels[i].compHeight / 2;
						})
						.attr("height", function(d, i, j) { 
							return textPosition.height(labels[i], i, j);
						})
				.transition()
					.duration(instant ? 0 : 250)
					.attr("x", function(d, i, j) { 
							return textPosition.x(labels[i], i, j);
						})
					.attr("width", function(d, i, j) { 
							return textPosition.width(labels[i], i, j);
						});
		}

		cleanup();
	};

	self.redraw();

	//determine initial orientation after drawing
	(function() {
		switch(self.layout.graph.style) {
			case "group": 
				self.groupTransition(true);
				return;
			case "stack":
				self.stackTransition(true);
				return;
			default:
				console.error("invalid layout style "+self.layout.graph.style);
		}
	})();

};

BarGraph.prototype.defaults = {
	formatting: {
		numFormat: '',
		strFormat: "%n"
	},

	font: {
		align: "center",
		face: "sans-serif",
		weight: "normal",
		style: "normal",
		size: "10px"
	},

	display: {
		labels: {
			aggregate: {
				show: false,
				formatting: undefined,
				font: undefined
			},

			bars: {
				formatting: undefined,
				font: undefined,
				show: true,
				hideSmallValueLabels: true,
				hideThreshold: 0,
				gradient: false
			},

			x: {
				formatting: undefined,
				font: undefined,
				text: ""
			},

			y: {
				formatting: undefined,
				font: undefined,
				text: ""
			},

			tooltip: {
				formatting: undefined
			},

			axes: {
				formatting: undefined,
				font: undefined
			},

			legend: {
				formatting: undefined,
				font: undefined
			}
		},

		grid: {
			lines: "horizontal",
			tickPadding: 7,
			tickCount: 10
		},

		target: "body"
	},

	layout: {
		margin: {
			top:    20,
			bottom: 40,
			left:   50,
			right:  55
		},
		padding:    30,
		width:      960,
		height:     500,

		graph: {
			style:  "group",
			type:   "value",
			bars: {
				direction:  "vertical",
				spacing:    0,
				maxWidth:   null 
			}
		},

		legend: {
			width:  100,
			height: 100,
			compass: "right"
		}
	},

	data: {
		graph:  undefined,
		legend: undefined
	}
};

BarGraph.prototype.currentItem = 0;

root = typeof exports !== "undefined" && exports !== null ? exports : window;
root.BarGraph = BarGraph;