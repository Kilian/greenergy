var Ico = {
  Base: {},

  SparkLine: {},
  SparkBar: {},

  BaseGraph: {},
  LineGraph: {},
  StackGraph: {},
  BarGraph: {},
  HorizontalBarGraph: {}
}

Ico.Base = Class.create({
  /* Returns a suitable set of labels for given data points on the Y axis */
  labelStep: function(data,stacked) {
    var min = (stacked) ? 0 : data.min(),
        max = data.max(),
        range = max - min,
        step = 0;

    if (range < 2) {
      step = 0.1;
    } else if (range < 3) {
      step = 0.2;
    } else if (range < 5) {
      step = 0.5;
    } else if (range < 11) {
      step = 1;
    } else if (range < 21) {
      step = 2;
    } else if (range < 50) {
      step = 5;
    } else if (range < 100) {
      step = 10;
    } else {
      step = Math.pow(20, (Math.log(range) / Math.LN10).round() - 1);
    }

    return step;
  }
});

Ico.SparkLine = Class.create(Ico.Base, {
  initialize: function(element, data, options) {
    this.element = element;
    this.data = data;

    this.options = {
      width:                  parseInt(element.getStyle('width')),
      height:                 parseInt(element.getStyle('height')),
      highlight:              false,
      background_colour:      element.getStyle('backgroundColor'),
      colour:                 '#036'
    };
    Object.extend(this.options, options || { });

    this.step = this.calculateStep();
    this.paper = Raphael(this.element, this.options['width'], this.options['height']);
    if (this.options['acceptable_range']) {
      this.background = this.paper.rect(0, this.options['height'] - this.normalise(this.options['acceptable_range'][1]),
                                        this.options['width'], this.options['height'] - this.normalise(this.options['acceptable_range'][0]));
    } else {
      this.background = this.paper.rect(0, 0, this.options['width'], this.options['height']);
    }
    this.background.attr({fill: this.options['background_colour'], stroke: 'none' });
    this.draw();
  },

  calculateStep: function() {
    return this.options['width'] / (this.data.length - 1);
  },

  normalisedData: function() {
    return $A(this.data).collect(function(value) {
      return this.normalise(value);
    }.bind(this))
  },

  normalise: function(value) {
    return (this.options['height'] / this.data.max()) * value;
  },

  draw: function() {
    var data = this.normalisedData();
    this.drawLines('', this.options['colour'], data);

    if (this.options['highlight']) {
      this.showHighlight(data);
    }
  },

  drawLines: function(label, colour, data) {
    var line = this.paper.path({ stroke: colour }).moveTo(0, this.options['height'] - data.first());
    var x = 0;
    data.slice(1).each(function(value) {
      x = x + this.step;
      line.lineTo(x, this.options['height'] - value);
    }.bind(this))
  },

  showHighlight: function(data) {
    var size = 2,
        x = this.options['width'] - size,
        i = this.options['highlight']['index'] || data.length - 1,
        y = data[i] + ((size / 2).round());

    // Find the x position if it's not the last value
    if (typeof(this.options['highlight']['index']) != 'undefined') {
      x = this.step * this.options['highlight']['index'];
    }

    var circle = this.paper.circle(x, this.options['height'] - y, size);
    circle.attr({ stroke: false, fill: this.options['highlight']['colour']})
  }
});

Ico.SparkBar = Class.create(Ico.SparkLine, {
  calculateStep: function() {
    return this.options['width'] / this.data.length;
  },

  drawLines: function(label, colour, data) {
    var width = this.step > 2 ? this.step - 1 : this.step;
    var x = width;
    var line = this.paper.path({ stroke: colour, 'stroke-width': width });
    data.each(function(value) {
      line.moveTo(x, this.options['height'] - value)
      line.lineTo(x, this.options['height']);
      x = x + this.step;
    }.bind(this))
  }
})

Ico.BaseGraph = Class.create(Ico.Base, {
  initialize: function(element, data, options) {
    this.element = element;

    this.data_sets = Object.isArray(data) ? new Hash({ one: data }) : $H(data);
    this.flat_data = this.data_sets.collect(function(data_set) { return data_set[1] }).flatten();
    this.range = this.calculateRange();
    this.data_size = this.longestDataSetLength();
    var stacked = this.chartDefaults()["stacked"];
    this.start_value = this.calculateStartValue(stacked);

    if (this.start_value == 0) {
      this.range = this.max;
    }

    /* If one colour is specified, map it to a compatible set */
    if (options && options['colour']) {
      options['colours'] = {};
      this.data_sets.keys().each(function(key) {
        options['colours'][key] = options['colour'];
      });
    }

    this.options = {
      width:                  parseInt(element.getStyle('width')),
      height:                 parseInt(element.getStyle('height')),
      labels:                 $A($R(1, this.data_size)),            // Label data
      plot_padding:           10,                                   // Padding for the graph line/bar plots
      font_size:              10,                                   // Label font size
      show_horizontal_labels: true,
      show_vertical_labels:   true,
      vertical_label_unit:    false,
      colours:                this.makeRandomColours(),             // Line colours
      background_colour:      element.getStyle('backgroundColor'),
      label_colour:           '#666',                               // Label text colour
      markers:                false,                                // false, circle
      marker_size:            5,
      meanline:               false,
      y_padding_top:          20,
      draw_axis:              true,
      stacked_fill:           false,                                 // if true, show stacked lines instead of area's
      datalabels:             '',                                    // interactive, filled with same # of elements as graph items.
      start_at_zero:          true,                                  // allow line graphs to start at a non-zero horizontal step
      bargraph_firstcolour:   false,                                 // different colour for first value in horizontal graph
      hover_colour:           "#333333",                             // hover color if there are datalabels
      watermark:              false,
      watermark_orientation:  false,                                 // determine position of watermark. default is bottomright. currenty available is bottomright and middle
      horizontal_rounded:     false                                  // show rounded endings on horizontal bar charts if true
    };
    Object.extend(this.options, this.chartDefaults() || { });
    Object.extend(this.options, options || { });

    /* Padding around the graph area to make room for labels */
    this.x_padding_left = 10 + this.paddingLeftOffset();
    this.x_padding_left += (this.options["vertical_label_unit"] && !this.options["horizontalbar_padding"]) ? 10 : 0;
    this.x_padding_right = 20;
    this.x_padding = this.x_padding_left + this.x_padding_right;
    this.y_padding_top = this.options['y_padding_top'];
    this.y_padding_bottom = 20 + this.paddingBottomOffset();
    this.y_padding = this.y_padding_top + this.y_padding_bottom;

    this.graph_width = this.options['width'] - (this.x_padding);
    this.graph_height = this.options['height'] - (this.y_padding);

    this.step = this.calculateStep();
    this.label_step = this.labelStep(this.flat_data, stacked);

    /* Calculate how many labels are required */
    this.y_label_count = (this.range / this.label_step).round();
    this.value_labels = this.makeValueLabels(this.y_label_count);
    this.top_value = this.value_labels.last();
    if (this.start_value == 0) {
      this.range = this.top_value;
    }

    /* Grid control options */
    this.grid_start_offset = -1;

    /* Drawing */
    this.paper = Raphael(this.element, this.options['width'], this.options['height']);
    this.background = this.paper.rect(this.x_padding_left, this.y_padding_top, this.graph_width, this.graph_height);
    this.background.attr({fill: this.options['background_colour'], stroke: 'none' });

    if (this.options['meanline'] === true) {
      this.options['meanline'] = { 'stroke-width': '2px', stroke: '#BBBBBB' };
    }

    this.setChartSpecificOptions();
    this.draw();
  },

  chartDefaults: function() {
    /* Define in child class */
  },

  drawPlot: function(index, cursor, x, y, colour) {
    /* Define in child class */
  },

  drawHorizontalLabels: function() {
    /* Define in child class */
  },

  calculateStep: function() {
    /* Define in child classes */
  },

  calculateStartValue: function(stacked) {
    var min = this.flat_data.min();
    if(stacked) {
      return this.range < min || min < 0 ? min.floor() : 0;
    }
    return this.range < min || min < 0 ? min.round() : 0;
  },

  makeRandomColours: function(number) {
    var colours = {};
    this.data_sets.each(function(data) {
      colours[data[0]] = Raphael.hsb2rgb(Math.random(), 1, .75).hex;
    });
    return colours;
  },

  longestDataSetLength: function() {
    var length = 0;
    this.data_sets.each(function(data_set) {
      length = data_set[1].length > length ? data_set[1].length : length;
    });
    return length;
  },

  roundValue: function(value, length) {
    var multiplier = Math.pow(10, length);
    value *= multiplier;
    value = Math.round(value) / multiplier;
    return value;
  },

  roundValues: function(data, length) {
    return $A(data).collect(function(value) { return this.roundValue(value, length) }.bind(this));
  },

  paddingLeftOffset: function() {
    /* Find the longest label and multiply it by the font size */
    var data = this.flat_data;

    // Round values
    data = this.roundValues(data, 2);

    var longest_label_length = $A(data).sort(function(a, b) { return a.toString().length < b.toString().length }).first().toString().length;
    longest_label_length = longest_label_length > 2 ? longest_label_length - 1 : longest_label_length;
    return longest_label_length * this.options['font_size'];
  },

  paddingBottomOffset: function() {
    /* Find the longest label and multiply it by the font size */
    return this.options['font_size'];
  },

  /* Subtract the largest and smallest values from the data sets */
  calculateRange: function() {
    this.max = this.flat_data.max();
    this.min = this.flat_data.min();
    return this.max - this.min;
  },

  normaliseData: function(data) {
    return $A(data).collect(function(value) {
      return this.normalise(value);
    }.bind(this))
  },

  normalise: function(value) {
    var total = this.start_value == 0 ? this.top_value : this.range;
    return ((value / total) * (this.graph_height));
  },

  draw: function() {
    if (this.options['grid']) {
      this.drawGrid();
        if(this.options['watermark']) {
          this.drawWatermark();
        }
    }

    if (this.options['meanline']) {
      this.drawMeanLine(this.normaliseData(this.flat_data));
    }

    if(this.options['draw_axis']) {
      this.drawAxis();
    }

    if (this.options['show_vertical_labels']) {
      this.drawVerticalLabels();
    }

    if (this.options['show_horizontal_labels']) {
      this.drawHorizontalLabels();
    }

    if(!this.options['watermark']) {
        this.drawLinesInit(this, this.data);
    }

    if (this.start_value != 0) {
      this.drawFocusHint();
    }
  },
  drawLinesInit: function(thisgraph, data) {
    var thisgraph = thisgraph;
    thisgraph.data_sets.each(function(data, index) {
      thisgraph.drawLines(data[0], thisgraph.options['colours'][data[0]], thisgraph.normaliseData(data[1]), thisgraph.options['datalabels'][data[0]], thisgraph.element);
    }.bind(thisgraph));
  },
  drawWatermark: function() {
    var watermark = this.options['watermark'],
        watermarkimg = new Image(),
        thisgraph = this;
    watermarkimg.onload = function(){
      if(thisgraph.options["watermark_orientation"] == "middle") {
          var right = (thisgraph.graph_width - watermarkimg.width)/2 + thisgraph.x_padding_left;
          var bottom = (thisgraph.graph_height - watermarkimg.height)/2 + thisgraph.y_padding_top;
      } else {
        if (thisgraph.options["horizontalbar_padding"]) { var right = thisgraph.graph_width - (watermarkimg.width+thisgraph.x_padding_right*1.5) + thisgraph.x_padding_left;
        } else { var right = thisgraph.graph_width - watermarkimg.width + thisgraph.x_padding_left - 2;
        }
        var bottom = thisgraph.graph_height - watermarkimg.height + thisgraph.y_padding_top - 2;
      }
      var image = thisgraph.paper.image(watermarkimg.src, right, bottom, watermarkimg.width, watermarkimg.height);
      image.attr({'opacity': '0.4'});

      thisgraph.drawLinesInit(thisgraph, data);

      if(thisgraph.options["stacked_fill"]) {
        image.toFront();
      }
    }
    watermarkimg.src = watermark.src || watermark;
  },
  drawGrid: function() {
    var path = this.paper.path({ stroke: '#CCC', 'stroke-width': '1px' });

    if (this.options['show_vertical_labels'] && !this.options['horizontalbar_grid']) {
      var y = this.graph_height + this.y_padding_top;
      for (i = 0; i < this.y_label_count; i++) {
        y = y - (this.graph_height / this.y_label_count);
        path.moveTo(this.x_padding_left, y);
        path.lineTo(this.x_padding_left + this.graph_width, y);
      }
    }

    if (this.options['show_horizontal_labels']) {
      var x = this.x_padding_left + this.options['plot_padding'] + this.grid_start_offset,
          x_labels = this.options['labels'].length;

          if(this.options["horizontalbar_grid"]) {
            x_step = this.graph_width / this.y_label_count;
          } else {
            x_step = this.step;
          }

      for (i = 0; i < x_labels; i++) {
        path.moveTo(x, this.y_padding_top);
        path.lineTo(x, this.y_padding_top + this.graph_height);

        x = x + x_step;

      }

      x = x - this.options['plot_padding'] - 1;
      path.moveTo(x, this.y_padding_top);
      path.lineTo(x, this.y_padding_top + this.graph_height);
    }
  },

  drawLines: function(label, colour, data, datalabel, element) {
    var coords = this.calculateCoords(data);
    var y_offset = (this.graph_height + this.y_padding_top) + this.normalise(this.start_value);
    if(this.options["stacked_fill"]) {
      var y_offset = (this.graph_height + this.y_padding_top);
    }

    if(this.options["start_at_zero"] == false) {
      var odd_horizontal_offset=0;
      $A(coords).each(function(coord, index) {
        if(coord[1] == y_offset) {odd_horizontal_offset++;}
      });
      if(odd_horizontal_offset>1) {
        coords.splice(0,odd_horizontal_offset);
      }
    }

    if(this.options["stacked_fill"]) {
      var cursor = this.paper.path({stroke: colour, fill: colour, 'stroke-width': '0'});
      coords.unshift([coords[0][0],y_offset]);
      coords.push([coords[coords.length-1][0],y_offset]);
    } else {
      var cursor = this.paper.path({stroke: colour, 'stroke-width': '5px'});
    }

    if(this.options["datalabels"]) {
      var datalabelelem;
      var colorattr = (this.options["stacked_fill"]) ? "fill" : "stroke";
      var hover_colour = this.options["hover_colour"];
      cursor.node.onmouseover = function (e) {
        if(colorattr==="fill") { cursor.attr({fill: hover_colour});}
        else {                   cursor.attr({stroke: hover_colour});}

        var posx = 0;
        var posy = 0;
        if (!e) var e = window.event;
        if (e.pageX || e.pageY)   {
          posx = e.pageX;
          posy = e.pageY;
        }
        else if (e.clientX || e.clientY)   {
          posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
          posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        datalabelelem = '<div id="datalabelelem-'+element.id+'" style="left:'+posx+'px;top:'+posy+'px" class="datalabelelem">'+datalabel+'</div>';
        element.insert(datalabelelem);

        cursor.node.onmousemove = function(e) {
          var posx = 0;
          var posy = 0;
          if (!e) var e = window.event;
          if (e.pageX || e.pageY)   {
            posx = e.pageX;
            posy = e.pageY;
          }
          else if (e.clientX || e.clientY)   {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }
          $('datalabelelem-'+element.id).setStyle({left:posx+'px',top:posy+'px'});

        };
      };
      cursor.node.onmouseout = function () {
        if(colorattr==="fill") { cursor.attr({fill: colour});}
        else {                   cursor.attr({stroke: colour});}

        $('datalabelelem-'+element.id).remove();
      }

    }
    $A(coords).each(function(coord, index) {
      var x = coord[0],
          y = coord[1];
          this.drawPlot(index, cursor, x, y, colour, coords, datalabel, element);
    }.bind(this))
  },

  calculateCoords: function(data) {
    var x = this.x_padding_left + this.options['plot_padding'] - this.step;
    var y_offset = (this.graph_height + this.y_padding_top) + this.normalise(this.start_value);

    return $A(data).collect(function(value) {
      var y = y_offset - value;
      x = x + this.step;
      return [x, y];
    }.bind(this))
  },

  drawFocusHint: function() {
    var length = 5,
        x = this.x_padding_left + (length / 2) - 1,
        y = this.options['height'] - this.y_padding_bottom;
    var cursor = this.paper.path({stroke: this.options['label_colour'], 'stroke-width': 2});

    cursor.moveTo(x, y);
    cursor.lineTo(x - length, y - length);
    cursor.moveTo(x, y - length);
    cursor.lineTo(x - length, y - (length * 2));
  },

  drawMeanLine: function(data) {
    var cursor = this.paper.path(this.options['meanline']);
    var offset = $A(data).inject(0, function(value, sum) { return sum + value }) / data.length;

    cursor.moveTo(this.x_padding_left - 1, this.options['height'] - this.y_padding_bottom - offset);
    cursor.lineTo(this.graph_width + this.x_padding_left, this.options['height'] - this.y_padding_bottom - offset);
  },

  drawAxis: function() {
    var cursor = this.paper.path({stroke: this.options['label_colour']});

    cursor.moveTo(this.x_padding_left - 1, this.options['height'] - this.y_padding_bottom);
    cursor.lineTo(this.graph_width + this.x_padding_left, this.options['height'] - this.y_padding_bottom);

    cursor.moveTo(this.x_padding_left - 1, this.options['height'] - this.y_padding_bottom);
    cursor.lineTo(this.x_padding_left - 1, this.y_padding_top);
  },

  makeValueLabels: function(steps) {
    var step = this.label_step,
        label = this.start_value,
        labels = [];


    for (var i = 0; i < steps; i++) {
      label = this.roundValue((label + step), 2);
      labels.push(label);
    }
    return labels;
  },

  /* Axis label markers */
  drawMarkers: function(labels, direction, step, start_offset, font_offsets, extra_font_options) {
    function x_offset(value) {
      return value * direction[0];
    }

    function y_offset(value) {
      return value * direction[1];
    }

    /* Start at the origin */
    var x = this.x_padding_left - 1 + x_offset(start_offset),
        y = this.options['height'] - this.y_padding_bottom + y_offset(start_offset);

    var cursor = this.paper.path({stroke: this.options['label_colour']});

    font_options = {"font": this.options['font_size'] + 'px "Arial"', stroke: "none", fill: "#000"};
    Object.extend(font_options, extra_font_options || {});

    labels.each(function(label) {
      cursor.moveTo(x, y);
      cursor.lineTo(x + y_offset(5), y + x_offset(5));
      this.paper.text(x + font_offsets[0], y - font_offsets[1], label).attr(font_options).toFront();
      x = x + x_offset(step);
      y = y + y_offset(step);

    }.bind(this));
  },

  drawVerticalLabels: function() {
    var y_step = this.graph_height / this.y_label_count;
    var vertical_label_unit = (this.options["vertical_label_unit"]) ? " "+this.options["vertical_label_unit"] : "";
    for (var i = 0; i < this.value_labels.length; i++) {
      this.value_labels[i] += vertical_label_unit;
    }


    this.drawMarkers(this.value_labels, [0, -1], y_step, y_step, [-8, -2], { "text-anchor": 'end' });
  },

  drawHorizontalLabels: function() {
    this.drawMarkers(this.options['labels'], [1, 0], this.step, this.options['plot_padding'], [0, (this.options['font_size'] + 7) * -1]);
  }
});


Ico.LineGraph = Class.create(Ico.BaseGraph, {
  chartDefaults: function() {
    return { plot_padding: 10, stacked_fill:false };
  },

  setChartSpecificOptions: function() {
    if (typeof(this.options['curve_amount']) == 'undefined') {
      this.options['curve_amount'] = 10
    }
  },

  calculateStep: function() {
    return (this.graph_width - (this.options['plot_padding'] * 2)) / (this.data_size - 1);
  },

  startPlot: function(cursor, x, y, colour) {
    cursor.moveTo(x, y);
  },
  drawGraphMarkers: function(index,cursor,x,y,colour, datalabel, element) {
    var circle = this.paper.circle(x, y, this.options['marker_size']);
    circle.attr({ 'stroke-width': '1px', stroke: this.options['background_colour'], fill: colour });

    if(this.options["datalabels"]) {
      var datalabelelem;
      var old_marker_size = this.options["marker_size"];

      circle.node.onmouseover = function (e) {
        new_marker_size = parseInt(1.7*old_marker_size);
        circle.attr({r:new_marker_size});

        var posx = 0;
        var posy = 0;
        if (!e) var e = window.event;
        if (e.pageX || e.pageY)   {
          posx = e.pageX;
          posy = e.pageY;
        }
        else if (e.clientX || e.clientY)   {
          posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
          posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        datalabelelem = '<div id="datalabelelem-'+element.id+'" style="left:'+posx+'px;top:'+posy+'px" class="datalabelelem">'+datalabel+'</div>';
        element.insert(datalabelelem);

        cursor.node.onmousemove = function(e) {
          var posx = 0;
          var posy = 0;
          if (!e) var e = window.event;
          if (e.pageX || e.pageY)   {
            posx = e.pageX;
            posy = e.pageY;
          }
          else if (e.clientX || e.clientY)   {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }
          $('datalabelelem-'+element.id).setStyle({left:posx+'px',top:posy+'px'});

        };
      };

      circle.node.onmouseout = function () {
        circle.attr({r:old_marker_size});
        $('datalabelelem-'+element.id).remove();
      }
    }

  },
  drawPlot: function(index, cursor, x, y, colour, coords, datalabel, element) {

    if (this.options['markers'] == 'circle') {
      this.drawGraphMarkers(index,cursor,x,y,colour, datalabel, element);
    }
    if (index == 0) {
      return this.startPlot(cursor, x, y, colour);
    }

    if (this.options['curve_amount']) {
      cursor.cplineTo(x, y, this.options['curve_amount']);
    } else {
      cursor.lineTo(x, y);
    }
  }
});

Ico.StackGraph = Class.create(Ico.BaseGraph, {

  chartDefaults: function() {
    return { plot_padding: 10, stacked_fill:true, stacked:true };
  },

  setChartSpecificOptions: function() {
    if (typeof(this.options['curve_amount']) == 'undefined') {
      this.options['curve_amount'] = 10
    }
  },

  calculateStep: function() {
    return (this.graph_width - (this.options['plot_padding'] * 2)) / (this.data_size - 1);
  },

  startPlot: function(cursor, x, y, colour) {
    cursor.moveTo(x, y);
  },
  drawGraphMarkers: function(index, cursor, x, y, colour, datalabel, element) {
    var circle = this.paper.circle(x, y, this.options['marker_size']);
    circle.attr({ 'stroke-width': '1px', stroke: this.options['background_colour'], fill: colour });

    if(this.options["datalabels"]) {
      var datalabelelem;
      var old_marker_size = this.options["marker_size"];

      circle.node.onmouseover = function (e) {
        new_marker_size = parseInt(1.7*old_marker_size);
        circle.attr({r:new_marker_size});

        var posx = 0;
        var posy = 0;
        if (!e) var e = window.event;
        if (e.pageX || e.pageY)   {
          posx = e.pageX;
          posy = e.pageY;
        }
        else if (e.clientX || e.clientY)   {
          posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
          posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        datalabelelem = '<div id="datalabelelem-'+element.id+'" style="left:'+posx+'px;top:'+posy+'px" class="datalabelelem">'+datalabel+'</div>';
        element.insert(datalabelelem);

        cursor.node.onmousemove = function(e) {
          var posx = 0;
          var posy = 0;
          if (!e) var e = window.event;
          if (e.pageX || e.pageY)   {
            posx = e.pageX;
            posy = e.pageY;
          }
          else if (e.clientX || e.clientY)   {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }
          $('datalabelelem-'+element.id).setStyle({left:posx+'px',top:posy+'px'});

        };
      };

      circle.node.onmouseout = function () {
        circle.attr({r:old_marker_size});
        $('datalabelelem-'+element.id).remove();
      }
    }
  },

  drawPlot: function(index, cursor, x, y, colour, coords, datalabel, element) {
    if(this.options['markers'] == 'circle') {
      if(this.options['stacked_fill'] == true) {
        if (index != 0 && index != coords.length-1) {
          this.drawGraphMarkers(index,cursor,x,y,colour, datalabel, element);
        }
      } else {
         this.drawGraphMarkers(index,cursor,x,y,colour, datalabel, element);
      }
    }
    if (index == 0) {
      return this.startPlot(cursor, x, y, colour);
    }

    if (this.options['curve_amount'] && index > 1 && (index < coords.length-1)) {
      cursor.cplineTo(x, y, this.options['curve_amount']);
    } else if (this.options['curve_amount'] && !this.options["stacked_fill"] && (index = 1 || (index = coords.length-1))) {
      cursor.cplineTo(x, y, this.options['curve_amount']);
    } else {
      cursor.lineTo(x, y);
    }
  }
});


/* This is based on the line graph, I can probably inherit from a shared class here */
Ico.BarGraph = Class.create(Ico.BaseGraph, {
  chartDefaults: function() {
    return { plot_padding: 0 };
  },

  setChartSpecificOptions: function() {
    this.bar_padding = 5;
    this.bar_width = this.calculateBarWidth();
    this.options['plot_padding'] = (this.bar_width / 2);
    this.step = this.calculateStep();
    this.grid_start_offset = this.bar_padding - 1;
  },

  calculateBarWidth: function() {
    return (this.graph_width / this.data_size) - this.bar_padding;
  },

  calculateStep: function() {
    return (this.graph_width - (this.options['plot_padding'] * 2) - (this.bar_padding * 2)) / (this.data_size - 1);
  },

  drawPlot: function(index, cursor, x, y, colour) {
    var start_y = this.options['height'] - this.y_padding_bottom;
    x = x + this.bar_padding;
    cursor.moveTo(x, start_y);
    cursor.attr({stroke: colour, 'stroke-width': this.bar_width + 'px'});
    cursor.lineTo(x, y);
    x = x + this.step;
    cursor.moveTo(x, start_y);
  },

  /* Change the standard options to correctly offset against the bars */
  drawHorizontalLabels: function() {
    var x_start = this.bar_padding + this.options['plot_padding'];
    this.drawMarkers(this.options['labels'], [1, 0], this.step, x_start, [0, (this.options['font_size'] + 7) * -1]);
  }
});

/* This is based on the line graph, I can probably inherit from a shared class here */
Ico.HorizontalBarGraph = Class.create(Ico.BarGraph, {
  setChartSpecificOptions: function() {
    // Approximate the width required by the labels
    this.x_padding_left = 12 + this.longestLabel() * (this.options['font_size'] / 2);
    this.graph_width = this.options["width"] - this.x_padding_right - this.x_padding_left;
    this.bar_padding = 5;
    this.bar_width = this.calculateBarHeight();
    this.options['plot_padding'] = 0;
    this.step = this.calculateStep();
    this.options["horizontalbar_grid"] = true;
    this.options["horizontalbar_padding"] = true;
  },

  normalise: function(value) {
    var offset = this.x_padding_left;
    return ((value / this.range) * (this.graph_width - offset));
  },

  longestLabel: function() {
    return $A(this.options['labels']).sort(function(a, b) { return a.toString().length < b.toString().length }).first().toString().length;
  },

  /* Height */
  calculateBarHeight: function() {
    return (this.graph_height / this.data_size) - this.bar_padding;
  },

  calculateStep: function() {
    return (this.graph_height - (this.options['plot_padding'] * 2)) / (this.data_size);
  },
  drawLines: function(label, colour, data, datalabel, element) {
    var x = this.x_padding_left + this.options['plot_padding'];
    var y = this.options['height'] - this.y_padding_bottom - (this.step / 2);
    var firstcolor = this.options['bargraph_firstcolour'];

    $A(data).each(function(value, number) {
      var colour2;
      if(firstcolor && value == $A(data).first()){
        colour2 = firstcolor;
      } else {
        colour2 = colour;
      }


//    var cursor = this.paper.path({stroke: colour2, 'stroke-width': this.bar_width + 'px'}).moveTo(x, y);
//    cursor.lineTo(x + value - this.normalise(this.start_value), y).attr({ 'stroke-linecap':'round'});
      var horizontal_rounded = this.options["horizontal_rounded"] ? this.bar_width/2 : 0;
      var cursor = this.paper.rect(x, (y-this.bar_width/2), x + value - this.normalise(this.start_value), this.bar_width, horizontal_rounded);
      cursor.attr({fill: colour2, 'stroke-width': 0});
      if(horizontal_rounded){
        var cursor2 = this.paper.rect(x, (y-this.bar_width/2)-0.5, x + value - this.normalise(this.start_value)-this.bar_width/2, this.bar_width+0.5);
            cursor2.attr({fill: colour2, 'stroke-width': 0});
        cursor.toFront();
        cursor.secondnode = cursor2;
      }

      y = y - this.step;


      if(this.options["datalabels"]) {
      var hover_colour = this.options["hover_colour"];
        cursor.node.onmouseover = function (e) {
          cursor.attr({fill: hover_colour});
          if(horizontal_rounded){cursor.secondnode.attr({fill: hover_colour});}
          var posx = 0;
          var posy = 0;
          if (!e) var e = window.event;
          if (e.pageX || e.pageY)   {
            posx = e.pageX;
            posy = e.pageY;
          }
          else if (e.clientX || e.clientY)   {
            posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
          }
          var datalabelelem = '<div id="datalabelelem-'+element.id+'" style="left:'+posx+'px;top:'+posy+'px" class="datalabelelem">'+datalabel[number]+'</div>';
          element.insert(datalabelelem);

          cursor.node.onmousemove = function(e) {
            var posx = 0;
            var posy = 0;
            if (!e) var e = window.event;
            if (e.pageX || e.pageY)   {
              posx = e.pageX;
              posy = e.pageY;
            }
            else if (e.clientX || e.clientY)   {
              posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
              posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            }

            $('datalabelelem-'+element.id).setStyle({left:posx+'px',top:posy+'px'});
          };
        };
        cursor.node.onmouseout = function (e) {
          cursor.attr({fill: colour2});
          if(horizontal_rounded){cursor.secondnode.attr({fill: colour2});}
          $('datalabelelem-'+element.id).remove();
        };
      }
    }.bind(this))
  },

  /* Horizontal version */
  drawFocusHint: function() {
    var length = 5,
        x = this.x_padding_left + (this.step * 2),
        y = this.options['height'] - this.y_padding_bottom;
    var cursor = this.paper.path({stroke: this.options['label_colour'], 'stroke-width': 2});

    cursor.moveTo(x, y);
    cursor.lineTo(x - length, y + length);
    cursor.moveTo(x - length, y);
    cursor.lineTo(x - (length * 2), y + length);
  },

  drawVerticalLabels: function() {
    var y_start = (this.step / 2) - this.options['plot_padding'];
    this.drawMarkers(this.options['labels'], [0, -1], this.step, y_start, [-8, -(this.options['font_size'] / 5)], { "text-anchor": 'end' });
  },

  drawHorizontalLabels: function() {
    var x_step = this.graph_width / this.y_label_count,
        x_labels = this.makeValueLabels(this.y_label_count);

        if(this.options["vertical_label_unit"]) {
          for(var i=0;i<x_labels.length;i++) {
            x_labels[i] += this.options["vertical_label_unit"];
          }
        }
    this.drawMarkers(x_labels, [1, 0], x_step, x_step, [0, (this.options['font_size'] + 7) * -1]);
  }
});

