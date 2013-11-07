
var HorizontalBarGraph = function(opts) {

	//merge the objects, taking only the data from opts
	var merged = Merge.BarMerge(this.defaults, opts);

	//this is the only data that needs to be accessible while rendering, since the rest was computed
	this.layout = merged.layout;
	this.data = merged.data;
	this.display = merged.display;

	//generating data points - we need to know how much to generate
	//every data set needs to be symmetric - I do not zero-fill missing data.
	var barsPerLayer = this.data.graph[0].data.length;
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
	var layerData = d3.range(barsPerLayer).map(function(v, idx) { return setupDataPoints(idx); });
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
				var ret = -d.compLen/2;
				if(self.layout.graph.style == "stack")
					if(d.isAggregate) 
						ret += xScale(d.y0);
					else
						ret += xScale(d.y0 + d.y/2);
				else 
					ret += xScale(d.y/2);

				return ret;
			},
			y: function(d, i, j) { 
				var ret = yScale(d.x);

				if(self.layout.graph.style == "stack") {
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : yScale.rangeBand()) / 2;

				} else {
					var offset = yScale.rangeBand() / barsPerLayer;
					ret += offset*j;
					ret += offset/2;
					ret += self.layout.graph.bars.spacing / 4;
				}

				return ret + d.compHeight/3;
			}
		};
		var left = {
			x: function(d, i, j) { 
				var ret = 1;

				if(self.layout.graph.style == "stack"){
					ret += xScale(d.y0);
				}

				return ret;
			},
			y: function(d, i, j) { return base.y(d, i, j); }
		};
		var right = {
			x: function(d, i, j) { 
				var ret = 0;

				if(self.layout.graph.style == "stack"){
					ret += xScale(d.y0 + d.y);
				} else {
					ret += xScale(d.y);
				}

				return ret - d.compLen - 1;
			},
			y: function(d, i, j) { return base.y(d, i, j); }
		};
		var top = {
			x: function(d, i, j) { return base.x(d, i, j); },
			y: function(d, i, j) { 
				var ret = yScale(d.x);

				if(self.layout.graph.style == "stack") {
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : yScale.rangeBand()/barsPerLayer);
					ret -= d.compHeight;

				} else {
					var offset = yScale.rangeBand() / barsPerLayer;
					ret += offset*j;
					ret += offset/2;
					ret -= d.compHeight/3;
					ret += self.layout.graph.bars.spacing/4;
				}

				return ret;
			}
		};
		var bottom = {
			x: function(d, i, j) { return base.x(d, i, j); },
			y: function(d, i, j) { 
				var ret = yScale(d.x);

				if(self.layout.graph.style == "stack") {
					ret += (self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : yScale.rangeBand());

				} else {
					var offset = yScale.rangeBand() / barsPerLayer;
					ret += offset*(j+1);
					ret += self.layout.graph.bars.spacing / 4;
				}

				return ret -= d.compHeight/3;
			}
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
		xScale = d3.scale.linear()
			.domain([yStackMax, 0])
			.range([self.layout.width, 0]);

		yScale = d3.scale.ordinal()
			.domain(d3.range(layerCount))
			.rangeRoundBands([0, self.layout.height], 0.08);

		xAxis = d3.svg.axis()
			.scale(xScale)
			.tickSize((self.display.grid.lines.indexOf("vert") !== -1 ? -self.layout.width : 0), 0, 0)
			.tickPadding(self.display.grid.tickPadding)
			.ticks(self.display.grid.tickCount)
			.orient("bottom");

		yAxis = d3.svg.axis()
			.scale(yScale)
			.orient("left")
			.tickSize(0)
			.tickPadding(self.display.grid.tickPadding);


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
				.attr("class", "graph-horizontal")
			.append("g")
				.attr("transform", "translate(" + bounds.offsetX + "," + bounds.offsetY + ")");

			svgElement.append("g")         
				.attr("class", "grid")
				.call(yAxis);

			svgElement.append("g")
				.attr("class", "y axis")
				.attr("stroke-width", "0")
				.attr("transform", "translate(-10,0)")
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
				.attr("y", -25)
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
					//.attr("width", self.layout.graph.bars.maxWidth ? self.layout.graph.bars.maxWidth : xScale.rangeBand())
					.attr("class", function(d) { return "rectInner "+d.id; })
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

	var cleanupSVG = function() {
		//change the axis text, rotate it, and reposition it
		svgElement.selectAll(".y.axis .tick text")
			.text(function(x) { return self.data.graph[x].name; })
			.attr("transform", "rotate(-90)")
			.each(function(d) {
				var me = d3.select(this);
				var myHeight = this.getBBox().width;

				me.attr("x", parseInt(me.attr("x")) + myHeight/2);
			});

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

		rect.transition()
			.duration(instant ? 0 : 500)
			.delay(function(d, i) { return instant ? 0 : i * 10; })
				.attr("x", function(d, i, j) { 
					return 0;
				})
				.attr("width", function(d, i, j) {
					return xScale(d.y);
				})
			.transition()
				.duration(instant ? 0 : 250)
				.attr("y", function(d, i, j) { 
					return yScale(d.x) + yScale.rangeBand() / barsPerLayer*j;
				})
				.attr("height", function(d, i, j) { 
					return (self.layout.graph.bars.maxWidth 
						? self.layout.graph.bars.maxWidth 
						: yScale.rangeBand() / barsPerLayer) 
					- self.layout.graph.bars.spacing/2;
				})
				.each("end", function(d) {

					var me = d3.select(this);
					var text = svgElement.select("."+d.id);
					var myWidth = me.attr("width");

					if(self.display.labels.bars.hideSmallValueLabels && myWidth <= d.compLen) {
						text.style("visibility", "hidden");
					} else {
						text.style("visibility", "visible");
					}
				});

		text
			.transition()
				.duration(instant ? 0 : 500)
				.delay(function(d, i) { return instant ? 0 : i * 10; })
					.attr("x", textPosition.x)
			.transition()
				.duration(instant ? 0 : 250)
				.attr("y", textPosition.y);

		if(self.display.labels.aggregate.show) {
			aggregateLabels
				.transition()
					.duration(instant ? 0 : 500)
					.delay(function(d, i) { return instant ? 0 : i * 10; })
						.attr("opacity", 0);
		}
	};

	//transition to a stacked graph
	self.stackTransition = function transitionStacked(instant) {

		self.layout.graph.style="stack";
		var textPosition = textPositionCalc();

		rect.transition()
			.duration(instant ? 0 : 500)
			.delay(function(d, i) { return instant ? 0 : i * 10; })
				.attr("y", function(d, i, j) { 
					return yScale(d.x);
				})
				.attr("height", function(d, i, j) { 
					return self.layout.graph.bars.maxWidth 
						? self.layout.graph.bars.maxWidth 
						: yScale.rangeBand();
				})
			.transition()
				.duration(instant ? 0 : 250)
				.attr("x", function(d, i, j) { 
					return xScale(d.y0);
				})
				.attr("width", function(d, i, j) {
					return xScale(d.y);
				})
				.each("end", function(d) {

					var me = d3.select(this);
					var text = svgElement.select("."+d.id);
					var myWidth = me.attr("width");

					if(self.display.labels.bars.hideSmallValueLabels && myWidth <= d.compLen) {
						text.style("visibility", "hidden");
					} else {
						text.style("visibility", "visible");
					}
				});

		text
			.transition()
				.duration(instant ? 0 : 500)
				.delay(function(d, i) { return instant ? 0 : i * 10; })
					.attr("y", textPosition.y)
			.transition()
				.duration(instant ? 0 : 250)
				.attr("x", textPosition.x);

		if(self.display.labels.aggregate.show) {

			var labels = totalLabels();

			aggregateLabels
				.transition()
					.duration(instant ? 0 : 500)
					.delay(function(d, i) { return instant ? 0 : i * 10; })
						.attr("opacity", 1)
						.attr("x", function(d, i, j) { 
							return textPosition.x(labels[i], i, j) + 1 + labels[i].compLen/2;
						})
				.transition()
					.duration(instant ? 0 : 250)
					.attr("y", function(d, i, j) { 
							return textPosition.y(labels[i], i, j);
						});
		}
	};

	self.redraw();
	cleanupSVG();

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

HorizontalBarGraph.prototype.defaults =  {
	formatting: {
		numFormat: '',
		strFormat: "%n",
		formatter: function(d) { return d; }
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
				swap: false,
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
			lines: "vertical",
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

HorizontalBarGraph.prototype.currentItem = 0;