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
  labelStep: function(data) {
    var min = data.min(),
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
    this.start_value = this.calculateStartValue();

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
      colours:                this.makeRandomColours(),             // Line colours
      background_colour:      element.getStyle('backgroundColor'),
      label_colour:           '#666',                               // Label text colour
      markers:                false,                                // false, circle
      marker_size:            5,
      meanline:               false,
      y_padding_top:          20,
      stacked_fill:           false,                                 // fill the area in a stacked graph
      draw_axis:              true,
      datalabels:             '',                                   // interactive, filled with same # of elements as graph items.
      percentages:            false,                                // opt for percentage in horizontal graph horizontal labels
      start_at_zero:          true,                                 // allow line graphs to start at a non-zero horizontal step
      bargraph_firstcolour:   false,                                // different colour for first value in horizontal graph
      hover_colour:           "#333333",                            // hover color if there are datalabels
      watermark:              false,
      watermark_orientation:  false                                 // determine position of watermark. default is bottomright. currenty available is bottomright and middle
    };
    Object.extend(this.options, this.chartDefaults() || { });
    Object.extend(this.options, options || { });

    /* Padding around the graph area to make room for labels */
    this.x_padding_left = 10 + this.paddingLeftOffset();
    this.x_padding_right = 20;
    this.x_padding = this.x_padding_left + this.x_padding_right;
    this.y_padding_top = this.options['y_padding_top'];
    this.y_padding_bottom = 20 + this.paddingBottomOffset();
    this.y_padding = this.y_padding_top + this.y_padding_bottom;

    this.graph_width = this.options['width'] - (this.x_padding);
    this.graph_height = this.options['height'] - (this.y_padding);

    this.step = this.calculateStep();
    this.label_step = this.labelStep(this.flat_data);

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

  calculateStartValue: function() {
    var min = this.flat_data.min();
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
        this.data_sets.each(function(data, index) {
          this.drawLines(data[0], this.options['colours'][data[0]], this.normaliseData(data[1]), this.options['datalabels'][data[0]], this.element);
        }.bind(this));
    }

    if (this.start_value != 0) {
      this.drawFocusHint();
    }

  },
  drawWatermark: function() {
    if(this.options["watermark"] == "wakoopa") {//undocumented feature lol!
      var text = this.paper.path({fill: "#000"}, "M 66.12653,28.643755 C 65.88927,28.5774 65.20644,28.15623 65.04322,27.975565 L 64.41948,26.909725 L 64.41948,9.6875 L 64.82874,8.948709 L 65.70556,8.128486 L 66.50282,7.887364 L 67.4056,7.893512 L 68.35306,8.277407 L 69.62782,7.900526 L 71.57226,7.832284 L 72.86932,8.057673 L 73.87705,8.448976 L 74.96575,9.201389 L 76.05217,10.294938 C 76.340077,10.692297 76.570098,11.12571 76.82223,11.545138 C 76.866135,11.63585 77.017825,11.875 77.03146,11.875 C 77.04509,11.875 77.286715,11.493668 77.36473,11.349026 C 77.549845,11.005848 78.44977,9.850685 78.76001,9.558018 L 79.76786,8.753663 L 80.77321,8.238848 L 81.90958,7.942295 L 82.54448,7.831621 L 84.55837,7.907413 L 85.0527,8.041652 C 85.68887,8.214409 87.882965,9.74993 88.38521,10.373885 L 89.13951,11.5625 L 89.5687,12.708333 L 89.69726,13.229166 L 89.69726,18.92361 L 89.29135,19.756944 L 88.41673,20.619728 L 87.42381,20.921315 L 86.50957,20.835946 L 85.76571,20.472012 L 84.48893,20.857646 L 82.22912,20.914775 L 81.65764,20.799442 L 80.62316,20.490104 L 79.68566,19.979401 L 78.69499,19.154267 C 78.385265,18.84918 77.48717,17.659929 77.32773,17.343749 L 77.09135,16.874999 L 77.02603,16.874999 L 76.96071,16.874999 L 76.82203,17.188508 C 76.783895,17.274723 76.425125,17.875544 76.32718,18.017227 L 75.97102,18.532437 L 75.36886,19.112424 C 74.89758,19.566354 73.232795,20.554069 72.68337,20.70572 L 72.12782,20.859064 L 69.48893,20.872297 L 69.41426,26.840275 C 69.342233,27.111491 69.188925,27.349265 69.07653,27.603145 L 68.57711,28.187895 L 67.89892,28.583885 L 67.02365,28.721955 L 66.12653,28.643755 z M 67.75282,27.854455 L 68.21785,27.526115 L 68.56507,26.979165 L 68.72504,26.631945 L 68.76482,19.843758 L 69.97059,20.138888 L 71.85004,20.136476 L 72.33615,20.035045 L 73.44726,19.622577 L 74.53197,18.909242 C 74.818725,18.658303 75.782695,17.53299 75.9447,17.26006 L 76.19387,16.840277 L 76.56187,15.729166 L 76.56651,13.090277 L 76.44302,12.644901 L 76.08452,11.732876 L 75.42542,10.739029 L 74.55942,9.845498 L 73.35485,9.017946 L 72.33615,8.651538 L 71.08615,8.626713 L 69.2806,8.771929 L 68.28655,9.122801 L 67.23976,8.591472 L 66.35765,8.662278 L 65.90528,8.896209 L 65.3724,9.445307 L 65.14865,9.916823 L 65.14865,26.740725 L 65.48292,27.395835 C 65.653368,27.608819 65.909339,27.716383 66.12087,27.875395 L 66.91948,27.981865 L 67.75282,27.854455 z M 69.94405,16.451126 L 69.15778,15.8782 L 68.75976,15.250586 L 68.75976,13.499413 L 69.15667,12.873555 L 69.8422,12.370331 L 70.50571,12.203258 L 71.07998,12.239086 L 71.8216,12.361914 L 72.58835,12.933453 L 72.96115,13.496661 L 72.96115,15.173611 L 72.58019,15.821672 C 72.346501,16.074016 72.03605,16.229114 71.76546,16.431726 L 71.542,16.527777 L 70.11393,16.518974 L 69.94405,16.451126 z M 72.23146,14.965277 L 72.23198,13.711458 L 72.12044,13.552212 C 72.08977,13.508419 71.805305,13.24548 71.72808,13.189538 L 71.44726,12.986111 L 70.23894,12.986111 L 69.45421,13.812547 L 69.45421,14.937452 L 70.1803,15.763888 L 71.48971,15.763888 L 72.23146,14.965277 z M 85.87936,19.642929 L 86.29117,19.890908 L 87.15389,20.138888 L 87.90009,19.995942 L 88.43984,19.582404 L 88.97635,18.739342 L 88.92814,12.951388 C 88.791141,12.54239 88.597185,12.156824 88.4257,11.762184 L 87.80208,10.824995 C 87.470345,10.40955 86.11859,9.271178 85.71491,9.067298 L 84.2931,8.611111 L 82.19726,8.613523 L 80.82474,9.01531 C 80.12561,9.3323105 77.970485,11.685374 77.69821,12.428994 L 77.5578,12.812499 L 77.49723,15.520833 L 77.61048,16.006944 L 77.96658,16.985075 L 78.65928,18.039323 L 79.62734,19.01844 L 80.65058,19.682229 L 81.91948,20.134999 L 84.55837,20.10193 L 85.87936,19.642929 z M 82.08933,16.328779 C 81.91249,16.214796 81.371655,15.660515 81.2671,15.48611 L 81.12139,15.243055 L 81.12087,13.620152 L 81.25592,13.264954 L 82.15855,12.44301 L 82.47504,12.256944 L 84.00282,12.259436 L 84.23646,12.385608 L 85.22705,13.368055 L 85.35394,13.645833 L 85.35698,15.073905 L 85.2538,15.320855 L 84.40621,16.313808 L 84.08317,16.527777 L 82.39807,16.527777 L 82.08933,16.328779 z M 84.5931,15.037203 L 84.5931,13.685388 L 83.76666,12.986111 L 82.70896,12.986111 L 81.88476,13.639298 L 81.88476,15.128232 L 82.68337,15.832813 L 83.77809,15.833333 L 84.5931,15.037203 z M 91.4506,21.289805 C 91.378945,21.264235 91.0187,21.066135 90.95371,21.016565 L 90.42115,20.357005 L 90.26205,19.598487 L 90.44053,18.784721 L 91.22827,18.011772 L 92.05837,17.837228 L 92.39703,17.913935 C 92.610059,17.978137 92.825842,18.043467 93.03682,18.107197 L 93.12554,16.90368 L 93.29214,16.215277 L 93.69946,15.435813 L 94.61224,14.523034 L 95.39171,14.108924 L 96.46224,13.888888 L 98.72504,13.891058 L 99.52035,14.078221 L 100.02846,14.465779 L 100.40075,15.084358 L 100.72869,14.800524 C 100.81888,14.72247 101.26873,14.393767 101.34917,14.347141 L 102.02365,14.070819 L 103.24666,13.874003 L 104.2806,14.032831 L 105.15728,14.441183 C 105.43621,14.750079 105.77283,14.996649 106.08246,15.2699 L 106.50282,14.494109 L 107.01316,14.081427 L 107.79753,13.899093 L 108.16864,13.995753 L 108.53974,14.092413 L 109.01434,13.991856 L 110.05699,13.888888 L 110.59112,14.025496 C 110.73801,14.063064 111.35747,14.264826 111.44555,14.30379 L 111.76586,14.445475 L 112.50216,14.108388 L 113.56809,13.87124 L 114.59893,13.964653 L 115.46115,14.235318 L 116.38962,14.923212 L 116.6769,15.286656 C 116.86422,15.523623 117.27253,16.345657 117.33542,16.612397 L 117.43826,17.04861 L 117.44032,19.766458 L 117.22279,20.498962 L 116.92835,20.793403 L 116.31192,21.168925 C 116.22337,21.19122 115.79317,21.249995 115.71854,21.249995 L 115.2111,21.170965 C 115.14619,21.14923 114.81253,20.97131 114.75089,20.925555 L 114.33423,20.431673 L 114.14171,20.104166 L 114.07226,17.341136 L 113.83653,17.192833 L 113.44726,17.329423 L 113.37709,20.104166 L 113.06935,20.68101 L 112.54448,21.113965 L 112.30143,21.181595 C 112.14041,21.2264 111.40849,21.219505 111.21738,21.171385 L 110.90516,21.092765 L 110.29056,20.478167 L 110.07921,19.766458 L 110.07921,17.388888 L 109.91254,17.222222 L 109.62087,17.222222 L 109.45421,17.388888 L 109.45421,19.766458 L 109.23668,20.498962 L 108.6478,21.087845 L 108.3258,21.168925 C 108.13008,21.218205 107.3942,21.22673 107.23198,21.181595 L 106.73293,20.902785 L 106.29128,20.312155 L 106.10562,19.932701 L 105.69749,20.302042 L 104.93427,20.864645 L 104.22155,21.153125 L 103.16671,21.249175 L 102.4695,21.249995 L 102.0556,21.142225 L 101.36393,20.871444 C 101.28754,20.826619 100.83907,20.490717 100.74535,20.408131 L 100.40454,20.107817 L 99.8836,20.884015 L 99.14916,21.249995 L 95.99436,21.249995 C 95.243791,21.131778 94.787808,20.723437 94.21442,20.281452 L 93.93991,19.999999 L 93.66174,20.306074 L 93.54485,20.612147 L 92.60574,21.313255 L 91.4506,21.289805 z M 92.50889,20.536463 L 92.93648,20.138241 L 93.06506,19.619138 L 92.9268,19.113948 L 92.56248,18.749624 L 92.06887,18.61137 L 91.56649,18.72267 L 91.19142,19.060728 L 91.05143,19.612339 L 91.15455,20.136862 L 91.44969,20.472527 C 91.54951,20.543359 91.94119,20.679536 92.06481,20.686388 L 92.50889,20.536463 z M 99.45135,20.276414 L 99.66254,19.868008 L 99.66202,19.340277 L 99.3909,18.895631 L 98.97499,18.680555 L 96.39176,18.680555 L 95.99539,18.475589 L 95.70421,18.004439 L 95.70421,17.066993 L 96.24342,16.527777 L 98.91238,16.527777 L 99.40116,16.295838 L 99.67027,15.868055 L 99.6163,15.13782 L 99.28892,14.78933 L 98.79448,14.641688 L 95.94726,14.687499 L 94.72111,15.431143 L 94.04622,16.302935 L 93.81187,17.109047 L 93.87623,18.445487 L 94.23836,19.236478 L 94.9731,20.013352 L 95.59023,20.375017 L 96.22504,20.54618 L 98.90419,20.555555 L 99.45135,20.276414 z M 104.41948,20.342652 L 105.15755,19.838064 C 105.43055,19.569908 105.61043,19.230345 105.83191,18.92361 L 106.01671,18.576388 L 106.01671,16.701388 L 105.60969,15.898111 L 104.79637,15.077181 L 104.00282,14.687499 L 103.16948,14.687499 L 102.33615,14.687499 L 101.53321,15.063745 L 100.72618,15.833514 L 100.36704,16.493373 L 100.20013,17.451847 L 100.28819,18.399294 L 100.56723,19.145114 L 101.34273,20.002074 L 101.97912,20.375017 L 102.61393,20.54618 L 103.59169,20.555555 L 104.41948,20.342652 z M 102.0931,18.07383 L 102.0931,17.215324 L 102.30817,16.799413 L 102.75282,16.528297 L 103.56976,16.527777 L 104.02276,16.807744 L 104.24587,17.277934 L 104.24587,17.851683 L 104.05642,18.305095 L 103.61021,18.680555 L 102.69982,18.680555 L 102.0931,18.07383 z M 103.49146,17.421482 L 103.32609,17.222222 L 103.02365,17.222222 L 102.85698,17.388888 C 102.83965,17.471381 102.89867,17.796296 102.90659,17.873675 L 102.95619,17.923276 L 103.44726,17.881944 L 103.49146,17.421482 z M 108.28607,20.410022 L 108.55489,20.117095 L 108.6898,19.895833 L 108.69123,17.187499 L 108.82212,16.988978 L 109.35004,16.528692 L 110.23138,16.527777 L 110.63686,16.816505 L 110.8431,17.215324 L 110.84401,19.895833 C 110.96639,20.231313 111.35012,20.3179 111.58938,20.517424 L 112.05586,20.486939 L 112.29688,20.407395 L 112.64865,19.989343 L 112.64865,17.356649 L 112.8381,16.903237 L 113.28431,16.527777 L 114.25125,16.527777 L 114.83615,17.073031 L 114.9056,19.990444 L 115.19575,20.381944 L 115.77365,20.568735 L 116.35977,20.381944 L 116.68523,19.896962 L 116.64171,16.631944 L 116.2436,15.875508 L 115.46115,15.095273 L 114.63245,14.6912 L 113.28706,14.637162 L 112.91577,14.756375 L 111.74354,15.342683 L 111.08615,14.925572 L 110.20346,14.652777 L 109.2424,14.652777 L 108.46983,14.924313 L 108.21652,14.788545 L 107.8037,14.652777 L 107.18319,14.845397 L 106.88476,15.264495 L 106.88528,19.895833 L 107.16528,20.355076 L 107.61393,20.556562 C 107.84685,20.55183 108.06303,20.458649 108.28607,20.410022 z M 99.48893,17.19573 C 99.000743,17.196164 97.049363,17.248506 96.5621,17.270453 L 96.3782,17.660385 L 96.51753,17.881944 L 99.48893,18.020833 L 99.48893,17.19573 z M 5.25282,20.826367 L 3.72504,20.422372 L 3.30837,20.171278 C 2.73763,19.827334 0.850885,17.854202 0.57624,17.314051 C 0.535675,17.23427 0.29193,16.579756 0.24004,16.411274 L 0.05134,15.79861 L 0,10.215093 L 0.223,9.340277 L 0.70522,8.611728 L 1.36393,8.132128 L 2.22497,7.897951 C 2.6536043,7.9023786 3.0721721,7.997562 3.4946,8.051924 L 4.08082,8.356702 L 4.64035,8.916769 L 4.98802,9.607159 L 5.10671,9.965277 L 5.18337,15.104166 L 5.83821,15.763888 L 7.16849,15.763888 L 7.85698,15.119883 L 7.85698,10.354058 L 8.01081,9.618055 L 8.35246,8.923611 C 8.5698761,8.6426216 8.8786519,8.460513 9.14171,8.231245 L 9.79388,7.984611 L 10.66964,7.936022 L 11.52861,8.127778 L 12.26155,8.687018 L 12.79848,9.494126 L 12.96009,9.895833 L 13.0306,15.148429 L 13.68223,15.763888 L 15.10474,15.763888 L 15.76738,15.076415 L 15.80837,9.826388 L 16.19719,8.993055 L 16.85004,8.322436 C 17.084108,8.171743 17.359849,8.1144809 17.61393,8.010839 L 18.3431,7.918315 L 19.08787,8.014909 L 19.6935,8.261562 L 20.20954,8.722036 L 20.62739,9.34011 L 20.94217,10.544781 L 22.26671,9.190129 C 22.665436,8.8994121 23.100477,8.6668907 23.52413,8.416296 L 24.53108,8.049645 L 25.11393,7.896816 L 27.05837,7.832284 L 28.33719,8.054525 L 29.26865,8.405127 L 30.39492,9.154517 L 31.59308,10.397426 L 32.36716,11.388888 L 32.4056,1.909722 L 32.74068,1.077413 L 33.52728,0.290818 L 34.46884,-1.4210855e-14 L 35.32226,0.001648 C 35.638338,0.059796996 35.929498,0.19955172 36.23228,0.298231 L 36.80359,0.799002 L 37.31677,1.653147 L 37.47421,2.118055 L 37.51477,10.776827 C 39.115532,9.7919759 40.728732,8.8137558 42.36757,7.888068 L 42.78782,7.79003 C 43.188142,7.8427869 43.563503,7.993847 43.94934,8.100527 L 44.63398,8.64264 L 45.18954,9.444444 L 45.32226,10.452874 L 45.32226,11.079359 L 45.09344,11.544137 L 44.86462,12.008914 L 44.36003,12.375984 L 41.54059,14.270833 L 41.53754,14.44787 C 41.999822,14.742696 43.82206,15.961651 44.27218,16.274541 L 44.74987,16.631944 L 45.05343,17.251903 L 45.35698,17.871863 L 45.35534,18.645833 L 45.15655,19.392724 L 44.66407,20.134451 L 43.9788,20.676122 L 43.06848,20.922535 C 42.694995,20.908595 42.336934,20.795475 41.97206,20.730831 L 41.60796,20.619908 C 40.940681,20.175932 38.263004,18.412947 37.58478,17.98611 L 37.48711,18.385416 L 37.23505,19.485449 L 36.79736,20.146236 L 36.16627,20.62811 L 35.39171,20.85778 L 34.48893,20.856315 L 33.60813,20.603121 L 32.62621,19.583333 L 31.81214,20.407305 L 31.3257,20.707941 L 30.60004,20.901125 L 30.03497,20.902775 L 28.90762,20.461466 L 27.61393,20.868055 L 24.97504,20.868055 C 24.483661,20.760842 24.024814,20.555401 23.55697,20.377892 L 22.57079,19.785424 L 21.57806,18.881619 L 20.75868,17.844596 L 20.46115,17.362299 L 20.10072,17.725694 L 19.04214,19.083763 L 17.89755,19.999544 L 16.85004,20.544092 L 15.66948,20.863332 L 13.10004,20.857328 C 12.155195,20.620981 11.293919,20.17287 10.43969,19.722221 C 9.9772167,19.967769 9.5014905,20.186354 9.02897,20.412012 L 8.44726,20.642263 L 7.19726,20.900955 C 6.8722676,20.910114 5.5765276,20.844746 5.25282,20.826367 z M 9.17212,19.54083 L 10.44149,18.734127 C 10.684283,18.944312 10.957261,19.114976 11.21501,19.305299 L 12.15251,19.783047 L 13.53397,20.153523 L 15.80837,20.091782 L 16.7806,19.780508 L 17.71612,19.231083 L 18.63696,18.44988 C 18.931293,18.112229 19.174857,17.772988 19.45207,17.424144 L 19.9457,16.397856 L 20.14624,15.451388 L 20.14865,10.16363 L 19.68603,9.241812 L 19.15161,8.806177 L 18.37577,8.654044 L 17.49008,8.843766 L 16.89884,9.328155 L 16.53754,10.006535 L 16.53677,14.965277 L 16.40028,15.456554 L 15.70409,16.237666 L 15.1048,16.527777 L 13.66472,16.527777 L 13.07887,16.244171 L 12.33199,15.31326 L 12.23063,10.034722 L 11.90365,9.340277 L 11.55508,8.970105 L 10.95041,8.661623 L 10.04448,8.650114 L 9.50061,8.837818 L 8.90378,9.38796 L 8.62087,10.144099 L 8.62087,15.129847 L 8.48245,15.493935 L 7.75377,16.264406 L 7.23752,16.527777 L 5.76919,16.527777 L 5.29041,16.327731 L 4.41948,15.243055 L 4.35004,9.895833 L 3.91896,9.131944 L 3.37782,8.750225 L 2.57921,8.604072 L 1.7806,8.750225 L 1.22833,9.136239 L 0.80837,9.81527 L 0.76826,15.451388 L 0.98507,16.42962 L 1.1951,16.873719 C 1.252855,16.995846 1.62381,17.624279 1.70676,17.740522 L 2.49388,18.621206 C 2.78622,18.896987 3.77157,19.591703 4.06541,19.729208 L 4.94941,20.035214 L 5.39171,20.134525 L 7.75282,20.095971 C 8.2375523,19.941269 8.7020213,19.733511 9.17212,19.54083 z M 28.77282,19.696812 L 29.02894,19.585062 C 29.214297,19.783449 29.46973,19.886062 29.68882,20.035671 L 30.35752,20.138888 L 31.03683,20.00714 L 32.0931,18.861696 L 32.0931,13.186502 C 32.019456,12.76363 31.824093,12.378651 31.67801,11.979166 L 31.096,10.996474 L 30.19303,10.024252 L 29.22739,9.248556 L 27.82226,8.645833 L 24.97504,8.647804 L 23.89988,9.012636 L 22.82226,9.681537 L 21.70519,10.798611 L 21.06059,11.840277 L 20.68301,12.951388 L 20.61759,15.2551 L 20.84942,16.399222 C 20.997529,16.793504 21.227645,17.14748 21.42051,17.51929 L 22.13238,18.397394 L 23.01162,19.202168 L 23.86025,19.720467 L 25.04448,20.129748 L 27.50447,20.138888 C 27.934443,20.012345 28.350599,19.845508 28.77282,19.696812 z M 25.30713,16.391005 C 25.16275,16.302972 24.472095,15.589985 24.40021,15.454758 L 24.28766,15.243055 L 24.23138,13.853397 L 24.39543,13.244167 L 24.75897,12.880627 L 25.12251,12.517086 L 25.59546,12.27251 L 26.7806,12.206185 L 27.35873,12.363195 L 28.02249,12.82061 L 28.48198,13.487387 L 28.48146,15.243055 L 28.33576,15.48611 C 28.231205,15.660515 27.690365,16.214796 27.51353,16.328779 L 27.20479,16.527777 L 25.5306,16.527258 L 25.30713,16.391005 z M 27.04558,15.755403 C 27.1577,15.6978 27.633805,15.231723 27.68957,15.124976 L 27.68551,13.61524 L 26.99629,12.986111 L 25.79449,12.986111 L 25.00976,13.711458 L 25.00976,15.018328 L 25.80589,15.833333 L 27.04558,15.755403 z M 36.54538,19.166666 L 36.74419,17.743055 L 36.7806,16.631944 L 41.71115,19.811648 L 42.4056,20.137531 L 43.30837,20.135838 L 43.86512,19.882913 L 44.33537,19.347333 L 44.59403,18.762585 L 44.67882,18.143929 L 44.2932,17.284655 L 43.61224,16.672413 L 40.2181,14.432615 L 40.22239,14.270833 C 40.879498,13.837117 43.490253,12.076501 44.1329,11.621857 C 44.18309,11.575321 44.416065,11.255316 44.45425,11.180472 L 44.59157,10.402072 L 44.46265,9.615367 L 44.00147,9.041103 L 43.2883,8.637011 L 42.63415,8.570652 L 42.03527,8.780433 L 36.80178,12.109687 L 36.74587,2.31374 L 36.54707,1.653157 L 36.17245,1.112584 L 35.40417,0.736701 L 34.48893,0.733404 L 33.95618,0.91748 L 33.45998,1.353156 L 33.13612,2.048611 L 33.13612,18.784721 L 33.46093,19.479166 L 33.9301,19.935521 L 34.55837,20.137522 L 35.5306,20.0914 C 35.992913,19.930621 36.230352,19.500764 36.54538,19.166666 z");
      var po = this.paper.path({fill: "#81e508"},"M 56.959209,20.312361 C 56.440882,20.244726 56.001555,19.948616 55.530602,19.743973 C 55.136598,19.423436 54.69356,19.154978 54.331946,18.800041 C 53.757674,18.135347 53.178055,17.428758 52.88401,16.592471 C 52.784311,16.142676 52.596798,15.703891 52.649097,15.235046 C 52.65914,14.568133 52.631804,13.897287 52.664996,13.232812 C 52.769793,12.78139 52.811099,12.308288 53.060678,11.906305 C 53.459916,11.004452 54.160743,10.285872 54.867149,9.6197522 C 55.305481,9.3470712 55.703535,8.9982021 56.20406,8.8431549 C 56.815475,8.6170435 57.458111,8.4259529 58.116176,8.4739387 C 58.630421,8.4901304 59.151597,8.4379635 59.661257,8.4993815 C 60.124348,8.6062785 60.61085,8.6424223 61.02684,8.8916613 C 61.37842,9.036393 61.709384,9.2153505 61.99646,9.4671612 C 62.963978,10.217089 63.741193,11.20512 64.259109,12.313169 C 64.410179,11.963245 64.37292,12.418405 64.404401,12.579714 C 64.531608,13.532204 64.473379,14.493515 64.487411,15.451388 C 64.446157,15.905695 64.404902,16.360002 64.363647,16.814308 C 64.244354,16.476541 64.166492,16.902885 64.073137,17.04348 C 63.919417,17.447708 63.660794,17.788105 63.394052,18.123562 C 63.032905,18.637349 62.511301,19.006444 62.072681,19.450371 C 61.599048,19.719468 61.1553,20.052055 60.621281,20.192862 C 60.337267,20.301578 60.055011,20.420008 59.744045,20.37972 C 58.943248,20.380428 58.138058,20.423427 57.339981,20.397957 C 57.213057,20.369425 57.086133,20.340893 56.959209,20.312361 z M 59.649651,16.534351 C 60.045619,16.377843 60.268977,15.981287 60.544809,15.679681 C 60.934258,15.04778 60.762822,14.276924 60.74975,13.557284 C 60.658177,13.162124 60.296508,12.93495 60.053879,12.633737 C 59.844345,12.430846 59.532202,12.36875 59.280602,12.223579 C 58.79516,12.232093 58.302608,12.205056 57.82149,12.235187 C 57.550144,12.335119 57.285855,12.445905 57.100641,12.678268 C 56.871302,12.911499 56.576252,13.097002 56.479665,13.426652 C 56.317426,14.045239 56.415023,14.71562 56.427484,15.352273 C 56.526312,15.602462 56.656555,15.830298 56.873804,15.996209 C 57.206053,16.296481 57.560236,16.739982 58.055482,16.665968 C 58.509117,16.655736 58.972766,16.687212 59.420257,16.651383 C 59.496721,16.612373 59.573186,16.573362 59.649651,16.534351 z");
      var go = this.paper.path({fill: "#a267a7"}, "M 48.829208,20.31222 C 48.475841,20.26696 48.15923,20.117402 47.848722,19.950523 C 47.500983,19.784652 47.148567,19.626111 46.868692,19.353899 C 46.527053,19.072235 46.150785,18.825368 45.901675,18.450726 C 45.750138,18.076852 45.370555,18.002256 45.370279,18.167118 C 45.408175,17.816897 45.169729,17.536553 45.044033,17.227794 C 44.94573,16.895387 44.622935,16.655396 44.61657,16.304934 C 44.565627,15.306511 44.530037,14.303668 44.515945,13.305312 C 44.615598,12.912874 44.670961,12.505081 44.765879,12.117294 C 45.004171,11.750482 45.201926,11.358687 45.323891,10.9375 C 45.553614,10.988884 45.628283,10.705038 45.777569,10.582517 C 46.397513,9.8712187 47.155265,9.2586612 48.008947,8.8558433 C 48.362028,8.7462212 48.706058,8.5832266 49.064931,8.5077636 C 50.002562,8.515315 50.944553,8.4964143 51.879464,8.5204694 C 52.358793,8.7029965 52.880412,8.7941701 53.302926,9.0994288 C 53.727448,9.3447325 54.116873,9.6447143 54.4785,9.974781 C 53.689823,10.786927 52.957902,11.719351 52.7408,12.859186 C 52.656166,13.014283 52.725699,13.637005 52.493893,13.255432 C 52.26722,13.027948 52.078437,12.750492 51.828419,12.553793 C 51.573248,12.453152 51.341001,12.255113 51.069884,12.222222 C 50.613742,12.230523 50.151009,12.205955 49.698865,12.234195 C 49.451044,12.336146 49.18894,12.416137 49.01877,12.637477 C 48.767275,12.898046 48.43867,13.10057 48.31405,13.456643 C 48.228577,14.101722 48.281667,14.767525 48.291744,15.419297 C 48.548606,15.737127 48.719534,16.140787 49.089953,16.345199 C 49.287991,16.464636 49.450473,16.689759 49.706248,16.63757 C 50.227433,16.640826 50.758021,16.685037 51.273435,16.663162 C 51.836961,16.39513 52.299009,15.932894 52.60545,15.392538 C 52.714172,15.813326 52.754796,16.257044 52.907221,16.663117 C 53.241271,17.476142 53.779385,18.177558 54.355564,18.833131 C 54.558494,19.246583 53.691442,19.468074 53.440246,19.746846 C 52.970891,20.021773 52.453932,20.244291 51.926826,20.369292 C 51.034896,20.379064 50.140989,20.408275 49.250288,20.40596 C 49.109928,20.374713 48.969568,20.343466 48.829208,20.31222 z");

    if(this.options["watermark_orientation"] == "middle") {
      var right = (this.graph_width - 118)/2 + this.x_padding_left;
      var bottom = (this.graph_height - 29)/2 + this.y_padding_top;
    } else {
      if (this.options["horizontalbar_padding"]) { var right = this.graph_width - (118+this.x_padding_right*1.5) + this.x_padding_left - 2; /* 1.5? dont ask. it works */
      } else {                                          var right = this.graph_width - 118 + this.x_padding_left - 2;
      }
      var bottom = this.graph_height - 29 +this.y_padding_top - 7;
    }
      text.translate(right, bottom).attr({opacity:"0.4"});
      po.translate(right, bottom).attr({opacity:"0.4"});
      go.translate(right, bottom).attr({opacity:"0.4"});

      this.data_sets.each(function(data, index) {
        this.drawLines(data[0], this.options['colours'][data[0]], this.normaliseData(data[1]), this.options['datalabels'][data[0]], this.element);
      }.bind(this));

      if(this.options["stacked_fill"]) {
        text.toFront();
        go.toFront();
        po.toFront();
      }

    } else {/* regular image watermark stuff here */
      var watermark = this.options['watermark'],
          watermarkimg = new Image(),
          thisgraph = this;
      watermarkimg.onload = function(){
        if(thisgraph.options["watermark_orientation"] == "middle") {
            var right = (thisgraph.graph_width - watermarkimg.width)/2 + thisgraph.x_padding_left;
            var bottom = (thisgraph.graph_height - watermarkimg.height)/2 + thisgraph.y_padding_top;
        } else {
          if (thisgraph.options["horizontalbar_padding"]) {  var right = thisgraph.graph_width - (watermarkimg.width+thisgraph.x_padding_right*1.5) + thisgraph.x_padding_left;
          } else {                                           var right = thisgraph.graph_width - watermarkimg.width + thisgraph.x_padding_left - 2;
          }
          var bottom = thisgraph.graph_height - watermarkimg.height + thisgraph.y_padding_top - 2;
        }
        var image = thisgraph.paper.image(watermarkimg.src, right, bottom, watermarkimg.width, watermarkimg.height);
        image.attr({'opacity': '0.4'});

        thisgraph.data_sets.each(function(data, index) {
          thisgraph.drawLines(data[0], thisgraph.options['colours'][data[0]], thisgraph.normaliseData(data[1]), thisgraph.options['datalabels'][data[0]], thisgraph.element);
        }.bind(thisgraph));

        if(thisgraph.options["stacked_fill"]) {
          image.toFront();
        }
      }
      watermarkimg.src = watermark.src || watermark;
    }
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
    return { plot_padding: 10, stacked_fill:true };
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


      var cursor = this.paper.path({stroke: colour2, 'stroke-width': this.bar_width + 'px'}).moveTo(x, y);

      cursor.lineTo(x + value - this.normalise(this.start_value), y);
      y = y - this.step;


      if(this.options["datalabels"]) {
      var hover_colour = this.options["hover_colour"];
        cursor.node.onmouseover = function (e) {
          cursor.attr({stroke: hover_colour});

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
          cursor.attr({stroke: colour2});
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

        if(this.options["percentages"]) {
          for(var i=0;i<x_labels.length;i++) {
            x_labels[i] += "%";
          }
        }
    this.drawMarkers(x_labels, [1, 0], x_step, x_step, [0, (this.options['font_size'] + 7) * -1]);
  }
});

