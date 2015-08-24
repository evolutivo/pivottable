﻿(function() {
  var $, PivotData, addSeparators, aggregatorTemplates, aggregators, convertToArray, dayNames, deriveAttributes, derivers, forEachRecord, getPivotData, mthNames, naturalSort, numberFormat, pivotTableRenderer, renderers, spanSize, zeroPad,
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    _this = this,
    __hasProp = {}.hasOwnProperty,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  $ = jQuery;

  /*
  Utilities
  */


  addSeparators = function(nStr, thousandsSep, decimalSep) {
    var rgx, x, x1, x2;
    nStr += '';
    x = nStr.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? decimalSep + x[1] : '';
    rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + thousandsSep + '$2');
    }
    return x1 + x2;
  };

  numberFormat = function(sigfig, scaler, thousandsSep, decimalSep) {
    if (sigfig == null) {
      sigfig = 3;
    }
    if (scaler == null) {
      scaler = 1;
    }
    if (thousandsSep == null) {
      thousandsSep = ",";
    }
    if (decimalSep == null) {
      decimalSep = ".";
    }
    return function(x) {
      if (x === 0 || isNaN(x) || !isFinite(x)) {
        return "";
      } else {
        return addSeparators((scaler * x).toFixed(sigfig), thousandsSep, decimalSep);
      }
    };
  };

  aggregatorTemplates = {
    sum: function(sigfig, scaler) {
      if (sigfig == null) {
        sigfig = 3;
      }
      if (scaler == null) {
        scaler = 1;
      }
      return function(_arg) {
        var attr;
        attr = 1 <= _arg.length ? __slice.call(_arg, 0) : [];
        return function() {
          return {
            sum: 0,
            push: function(record, idx) {
              if (!isNaN(parseFloat(record[attr[idx]]))) {
                return this.sum += parseFloat(record[attr[idx]]);
              }
            },
            value: function() {
              return this.sum;
            },
            format: numberFormat(sigfig, scaler),
            label: "Sum of " + attr
          };
        };
      };
    },
    average: function(sigfig, scaler) {
      if (sigfig == null) {
        sigfig = 3;
      }
      if (scaler == null) {
        scaler = 1;
      }
      return function(_arg) {
        var attr;
        attr = 1 <= _arg.length ? __slice.call(_arg, 0) : [];
        return function() {
          return {
            sum: 0,
            len: 0,
            push: function(record, idx) {
              if (!isNaN(parseFloat(record[attr[idx]]))) {
                this.sum += parseFloat(record[attr[idx]]);
                return this.len++;
              }
            },
            value: function() {
              return this.sum / this.len;
            },
            format: numberFormat(sigfig, scaler),
            label: "Average of " + attr
          };
        };
      };
    },
    sumOverSum: function(sigfig, scaler) {
      if (sigfig == null) {
        sigfig = 3;
      }
      if (scaler == null) {
        scaler = 1;
      }
      return function(_arg) {
        var denom, num;
        num = _arg[0], denom = _arg[1];
        return function() {
          return {
            sumNum: 0,
            sumDenom: 0,
            push: function(record, idx) {
              if (!isNaN(parseFloat(record[num]))) {
                this.sumNum += parseFloat(record[num]);
              }
              if (!isNaN(parseFloat(record[denom]))) {
                return this.sumDenom += parseFloat(record[denom]);
              }
            },
            value: function() {
              return this.sumNum / this.sumDenom;
            },
            format: numberFormat(sigfig, scaler),
            label: "" + num + "/" + denom
          };
        };
      };
    },
    sumOverSumBound80: function(sigfig, scaler, upper) {
      if (sigfig == null) {
        sigfig = 3;
      }
      if (scaler == null) {
        scaler = 1;
      }
      if (upper == null) {
        upper = true;
      }
      return function(_arg) {
        var denom, num;
        num = _arg[0], denom = _arg[1];
        return function() {
          return {
            sumNum: 0,
            sumDenom: 0,
            push: function(record, idx) {
              if (!isNaN(parseFloat(record[num]))) {
                this.sumNum += parseFloat(record[num]);
              }
              if (!isNaN(parseFloat(record[denom]))) {
                return this.sumDenom += parseFloat(record[denom]);
              }
            },
            value: function() {
              var sign;
              sign = upper ? 1 : -1;
              return (0.821187207574908 / this.sumDenom + this.sumNum / this.sumDenom + 1.2815515655446004 * sign * Math.sqrt(0.410593603787454 / (this.sumDenom * this.sumDenom) + (this.sumNum * (1 - this.sumNum / this.sumDenom)) / (this.sumDenom * this.sumDenom))) / (1 + 1.642374415149816 / this.sumDenom);
            },
            format: numberFormat(sigfig, scaler),
            label: "" + (upper ? "Upper" : "Lower") + " Bound of " + num + "/" + denom
          };
        };
      };
    },
    fractionOf: function(wrapped, type) {
      if (type == null) {
        type = "total";
      }
      return function() {
        var x;
        x = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return function(data, rowKey, colKey) {
          return {
            selector: {
              total: [[], []],
              row: [rowKey, []],
              col: [[], colKey]
            }[type],
            inner: wrapped.apply(null, x)(data, rowKey, colKey),
            push: function(record, idx) {
              return this.inner.push(record, idx);
            },
            format: function(v) {
              return numberFormat(2)(100 * v) + "%";
            },
            label: wrapped.apply(null, x)(data, rowKey, colKey).label + " % of " + type,
            value: function(idx) {
              var params;
              params = this.selector;
              params.push(idx);
              return this.inner.value() / data.getAggregator.apply(data, params).inner.value();
            }
          };
        };
      };
    },
    l10nWrapper: function(wrapped, formatter, labelFn) {
      return function() {
        var x;
        x = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return function(data, rowKey, colKey) {
          return {
            inner: wrapped.apply(null, x)(data, rowKey, colKey),
            push: function(record, idx) {
              return this.inner.push(record);
            },
            format: formatter,
            label: labelFn(data),
            value: function() {
              return this.inner.value();
            }
          };
        };
      };
    },
    compareWith: function() {
      return function(_arg) {
        var attr;
        attr = 1 <= _arg.length ? __slice.call(_arg, 0) : [];
        return function() {
          return {
            sumSource: 0,
            sumWith: 0,
            push: function(record, idx, valAttribs) {
              var idxs;
              idxs = valAttribs.split('->');
              if (!isNaN(parseFloat(record[idxs[0]]))) {
                this.sumSource += parseFloat(record[idxs[0]]);
              }
              if (!isNaN(parseFloat(record[idxs[1]]))) {
                return this.sumWith += parseFloat(record[idxs[1]]);
              }
            },
            format: function(v) {
              return numberFormat(2)(100 * v) + "%";
            },
            label: "% of " + attr,
            value: function() {
              return this.sumSource / this.sumWith;
            }
          };
        };
      };
    }
  };

  aggregators = {
    count: function() {
      return function() {
        return {
          count: 0,
          push: function() {
            return this.count++;
          },
          value: function() {
            return this.count;
          },
          format: numberFormat(0),
          label: "Count"
        };
      };
    },
    countUnique: function(_arg) {
      var attr;
      attr = _arg[0];
      return function() {
        return {
          uniq: [],
          push: function(record) {
            var _ref;
            if (_ref = record[attr], __indexOf.call(this.uniq, _ref) < 0) {
              return this.uniq.push(record[attr]);
            }
          },
          value: function() {
            return this.uniq.length;
          },
          format: numberFormat(0),
          label: "Count Unique " + attr
        };
      };
    },
    listUnique: function(_arg) {
      var attr;
      attr = _arg[0];
      return function() {
        return {
          uniq: [],
          push: function(record) {
            var _ref;
            if (_ref = record[attr], __indexOf.call(this.uniq, _ref) < 0) {
              return this.uniq.push(record[attr]);
            }
          },
          value: function() {
            return this.uniq.join(", ");
          },
          format: function(x) {
            return x;
          },
          label: "List Unique " + attr
        };
      };
    },
    intSum: aggregatorTemplates.sum(0),
    sum: aggregatorTemplates.sum(3),
    average: aggregatorTemplates.average(3),
    compareWith: aggregatorTemplates.compareWith(),
    sumOverSum: aggregatorTemplates.sumOverSum(3),
    ub80: aggregatorTemplates.sumOverSumBound80(3, 1, true),
    lb80: aggregatorTemplates.sumOverSumBound80(3, 1, false)
  };

  aggregators.sumAsFractionOfTotal = aggregatorTemplates.fractionOf(aggregators.sum);

  aggregators.sumAsFractionOfRow = aggregatorTemplates.fractionOf(aggregators.sum, "row");

  aggregators.sumAsFractionOfCol = aggregatorTemplates.fractionOf(aggregators.sum, "col");

  aggregators.countAsFractionOfTotal = aggregatorTemplates.fractionOf(aggregators.count);

  aggregators.countAsFractionOfRow = aggregatorTemplates.fractionOf(aggregators.count, "row");

  aggregators.countAsFractionOfCol = aggregatorTemplates.fractionOf(aggregators.count, "col");

  renderers = {
    "Table": function(pvtData, opts) {
      return pivotTableRenderer(pvtData, opts);
    },
    "Table Barchart": function(pvtData, opts) {
      return pivotTableRenderer(pvtData, opts).barchart();
    },
    "Heatmap": function(pvtData, opts) {
      return pivotTableRenderer(pvtData, opts).heatmap();
    },
    "Row Heatmap": function(pvtData, opts) {
      return pivotTableRenderer(pvtData, opts).heatmap("rowheatmap");
    },
    "Col Heatmap": function(pvtData, opts) {
      return pivotTableRenderer(pvtData, opts).heatmap("colheatmap");
    }
  };

  mthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  zeroPad = function(number) {
    return ("0" + number).substr(-2, 2);
  };

  derivers = {
    bin: function(col, binWidth) {
      return function(record) {
        return record[col] - record[col] % binWidth;
      };
    },
    dateFormat: function(col, formatString) {
      return function(record) {
        var date;
        date = new Date(Date.parse(record[col]));
        if (isNaN(date)) {
          return "";
        }
        return formatString.replace(/%(.)/g, function(m, p) {
          switch (p) {
            case "y":
              return date.getFullYear();
            case "m":
              return zeroPad(date.getMonth() + 1);
            case "n":
              return mthNames[date.getMonth()];
            case "d":
              return zeroPad(date.getDate());
            case "w":
              return dayNames[date.getDay()];
            case "x":
              return date.getDay();
            case "H":
              return zeroPad(date.getHours());
            case "M":
              return zeroPad(date.getMinutes());
            case "S":
              return zeroPad(date.getSeconds());
            default:
              return "%" + p;
          }
        });
      };
    }
  };

  naturalSort = function(as, bs) {
    var a, a1, b, b1, rd, rx, rz;
    rx = /(\d+)|(\D+)/g;
    rd = /\d/;
    rz = /^0/;
    if (typeof as === "number" || typeof bs === "number") {
      if (isNaN(as)) {
        return 1;
      }
      if (isNaN(bs)) {
        return -1;
      }
      return as - bs;
    }
    a = String(as).toLowerCase();
    b = String(bs).toLowerCase();
    if (a === b) {
      return 0;
    }
    if (!(rd.test(a) && rd.test(b))) {
      return (a > b ? 1 : -1);
    }
    a = a.match(rx);
    b = b.match(rx);
    while (a.length && b.length) {
      a1 = a.shift();
      b1 = b.shift();
      if (a1 !== b1) {
        if (rd.test(a1) && rd.test(b1)) {
          return a1.replace(rz, ".0") - b1.replace(rz, ".0");
        } else {
          return (a1 > b1 ? 1 : -1);
        }
      }
    }
    return a.length - b.length;
  };

  $.pivotUtilities = {
    aggregatorTemplates: aggregatorTemplates,
    aggregators: aggregators,
    renderers: renderers,
    derivers: derivers,
    naturalSort: naturalSort,
    numberFormat: numberFormat
  };

  /*
  functions for accessing input
  */


  deriveAttributes = function(record, derivedAttributes, f) {
    var k, v, _ref, _ref1;
    for (k in derivedAttributes) {
      v = derivedAttributes[k];
      record[k] = (_ref = v(record)) != null ? _ref : record[k];
    }
    for (k in record) {
      if (!__hasProp.call(record, k)) continue;
      if ((_ref1 = record[k]) == null) {
        record[k] = "null";
      }
    }
    return f(record);
  };

  forEachRecord = function(input, derivedAttributes, f) {
    var addRecord, compactRecord, i, j, k, record, tblCols, _i, _len, _ref, _results, _results1;
    addRecord = function(record) {
      return deriveAttributes(record, derivedAttributes, f);
    };
    if ($.isFunction(input)) {
      return input(addRecord);
    } else if ($.isArray(input)) {
      if ($.isArray(input[0])) {
        _results = [];
        for (i in input) {
          if (!__hasProp.call(input, i)) continue;
          compactRecord = input[i];
          if (!(i > 0)) {
            continue;
          }
          record = {};
          _ref = input[0];
          for (j in _ref) {
            if (!__hasProp.call(_ref, j)) continue;
            k = _ref[j];
            record[k] = compactRecord[j];
          }
          _results.push(addRecord(record));
        }
        return _results;
      } else {
        _results1 = [];
        for (_i = 0, _len = input.length; _i < _len; _i++) {
          record = input[_i];
          _results1.push(addRecord(record));
        }
        return _results1;
      }
    } else if (input instanceof jQuery) {
      tblCols = [];
      $("thead > tr > th", input).each(function(i) {
        return tblCols.push($(this).text());
      });
      return $("tbody > tr", input).each(function(i) {
        record = {};
        $("td", this).each(function(j) {
          return record[tblCols[j]] = $(this).text();
        });
        return addRecord(record);
      });
    } else {
      throw new Error("unknown input format");
    }
  };

  convertToArray = function(input) {
    var result;
    result = [];
    forEachRecord(input, {}, function(record) {
      return result.push(record);
    });
    return result;
  };

  PivotData = (function() {

    function PivotData(aggregator, colAttrs, rowAttrs, valAttrs, aggregatorKeys) {
      var i;
      this.aggregator = aggregator;
      this.colAttrs = colAttrs;
      this.rowAttrs = rowAttrs;
      this.valAttrs = valAttrs;
      this.aggregatorKeys = aggregatorKeys;
      this.getAggregator = __bind(this.getAggregator, this);

      this.flattenKey = __bind(this.flattenKey, this);

      this.getRowKeys = __bind(this.getRowKeys, this);

      this.getColKeys = __bind(this.getColKeys, this);

      this.sortKeys = __bind(this.sortKeys, this);

      this.arrSort = __bind(this.arrSort, this);

      this.natSort = __bind(this.natSort, this);

      this.tree = [this.aggregatorKeys.length];
      this.rowKeys = [];
      this.colKeys = [];
      this.flatRowKeys = [];
      this.flatColKeys = [];
      this.rowTotals = [this.aggregatorKeys.length];
      this.colTotals = [this.aggregatorKeys.length];
      this.allTotal = [this.aggregatorKeys.length];
      this.sorted = false;
      if (this.aggregatorKeys.length === 0) {
        this.allTotal[0] = this.aggregator[0](this, [], []);
        this.rowTotals[0] = {};
        this.colTotals[0] = {};
        this.tree[0] = {};
      } else {
        i = 0;
        while (i < this.aggregatorKeys.length) {
          this.allTotal[i] = this.aggregator[i](this, [], []);
          this.rowTotals[i] = {};
          this.colTotals[i] = {};
          this.tree[i] = {};
          i++;
        }
      }
    }

    PivotData.prototype.natSort = function(as, bs) {
      return naturalSort(as, bs);
    };

    PivotData.prototype.arrSort = function(a, b) {
      return this.natSort(a.join(), b.join());
    };

    PivotData.prototype.sortKeys = function() {
      if (!this.sorted) {
        this.rowKeys.sort(this.arrSort);
        this.colKeys.sort(this.arrSort);
      }
      return this.sorted = true;
    };

    PivotData.prototype.getColKeys = function() {
      this.sortKeys();
      return this.colKeys;
    };

    PivotData.prototype.getRowKeys = function() {
      this.sortKeys();
      return this.rowKeys;
    };

    PivotData.prototype.flattenKey = function(x) {
      return x.join(String.fromCharCode(0));
    };

    PivotData.prototype.processRecord = function(record, aggregatorKeys) {
      var colKey, flatColKey, flatRowKey, i, rowKey, x, _results;
      colKey = (function() {
        var _i, _len, _ref, _results;
        _ref = this.colAttrs;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          x = _ref[_i];
          _results.push(record[x]);
        }
        return _results;
      }).call(this);
      rowKey = (function() {
        var _i, _len, _ref, _results;
        _ref = this.rowAttrs;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          x = _ref[_i];
          _results.push(record[x]);
        }
        return _results;
      }).call(this);
      flatRowKey = this.flattenKey(rowKey);
      flatColKey = this.flattenKey(colKey);
      i = 0;
      while (i < aggregatorKeys.length) {
        this.allTotal[i].push(record, i, this.valAttrs[i]);
        i++;
      }
      if (rowKey.length !== 0) {
        if (__indexOf.call(this.flatRowKeys, flatRowKey) < 0) {
          this.rowKeys.push(rowKey);
          this.flatRowKeys.push(flatRowKey);
        }
        i = 0;
        while (i < aggregatorKeys.length) {
          if (!this.rowTotals[i][flatRowKey]) {
            this.rowTotals[i][flatRowKey] = this.aggregator[i](this, rowKey, []);
          }
          this.rowTotals[i][flatRowKey].push(record, i, this.valAttrs[i]);
          i++;
        }
      }
      if (colKey.length !== 0) {
        if (__indexOf.call(this.flatColKeys, flatColKey) < 0) {
          this.colKeys.push(colKey);
          this.flatColKeys.push(flatColKey);
        }
        i = 0;
        while (i < aggregatorKeys.length) {
          if (!this.colTotals[i][flatColKey]) {
            this.colTotals[i][flatColKey] = this.aggregator[i](this, [], colKey);
          }
          this.colTotals[i][flatColKey].push(record, i, this.valAttrs[i]);
          i++;
        }
      }
      if (colKey.length !== 0 && rowKey.length !== 0) {
        i = 0;
        _results = [];
        while (i < aggregatorKeys.length) {
          if (!(flatRowKey in this.tree[i])) {
            this.tree[i][flatRowKey] = {};
          }
          if (!(flatColKey in this.tree[i][flatRowKey])) {
            this.tree[i][flatRowKey][flatColKey] = this.aggregator[i](this, rowKey, colKey);
          }
          this.tree[i][flatRowKey][flatColKey].push(record, i, this.valAttrs[i]);
          _results.push(i++);
        }
        return _results;
      }
    };

    PivotData.prototype.getAggregator = function(rowKey, colKey, idx) {
      var agg, flatColKey, flatRowKey;
      flatRowKey = this.flattenKey(rowKey);
      flatColKey = this.flattenKey(colKey);
      if (rowKey.length === 0 && colKey.length === 0) {
        agg = this.allTotal[idx];
      } else if (rowKey.length === 0) {
        agg = this.colTotals[idx][flatColKey];
      } else if (colKey.length === 0) {
        agg = this.rowTotals[idx][flatRowKey];
      } else {
        agg = this.tree[idx][flatRowKey][flatColKey];
      }
      return agg != null ? agg : {
        value: (function() {
          return null;
        }),
        format: function() {
          return "";
        }
      };
    };

    return PivotData;

  })();

  getPivotData = function(input, cols, rows, vals, aggregator, aggregatorKeys, filter, derivedAttributes) {
    var pivotData;
    pivotData = new PivotData(aggregator, cols, rows, vals, aggregatorKeys);
    forEachRecord(input, derivedAttributes, function(record) {
      if (filter(record)) {
        return pivotData.processRecord(record, aggregatorKeys);
      }
    });
    return pivotData;
  };

  spanSize = function(arr, i, j) {
    var len, noDraw, stop, x, _i, _j;
    if (i !== 0) {
      noDraw = true;
      for (x = _i = 0; 0 <= j ? _i <= j : _i >= j; x = 0 <= j ? ++_i : --_i) {
        if (arr[i - 1][x] !== arr[i][x]) {
          noDraw = false;
        }
      }
      if (noDraw) {
        return -1;
      }
    }
    len = 0;
    while (i + len < arr.length) {
      stop = false;
      for (x = _j = 0; 0 <= j ? _j <= j : _j >= j; x = 0 <= j ? ++_j : --_j) {
        if (arr[i][x] !== arr[i + len][x]) {
          stop = true;
        }
      }
      if (stop) {
        break;
      }
      len++;
    }
    return len;
  };

  pivotTableRenderer = function(pivotData, opts) {
    var aggregator, c, colAttrs, colKey, colKeys, col_colspan, col_rowspan, defaults, i, j, r, result, rowAttrs, rowKey, rowKeys, th, totalAggregator, tr, txt, v, vKey, val, valAttrs, valsCount, x, xx;
    defaults = {
      localeStrings: {
        totals: "Totals"
      }
    };
    opts = $.extend(defaults, opts);
    valAttrs = pivotData.valAttrs;
    colAttrs = pivotData.colAttrs;
    rowAttrs = pivotData.rowAttrs;
    rowKeys = pivotData.getRowKeys();
    colKeys = pivotData.getColKeys();
    result = $("<table class='table table-bordered pvtTable'>");
    for (j in colAttrs) {
      if (!__hasProp.call(colAttrs, j)) continue;
      c = colAttrs[j];
      tr = $("<tr>");
      if (parseInt(j) === 0 && rowAttrs.length !== 0) {
        tr.append($("<th>").attr("colspan", rowAttrs.length).attr("rowspan", colAttrs.length));
      }
      tr.append($("<th class='pvtAxisLabel'>").text(c));
      col_colspan = pivotData.aggregatorKeys.length;
      col_rowspan = 1;
      valsCount = col_colspan;
      for (i in colKeys) {
        if (!__hasProp.call(colKeys, i)) continue;
        colKey = colKeys[i];
        x = spanSize(colKeys, parseInt(i), parseInt(j));
        if (x !== -1) {
          th = $("<th class='pvtColLabel'>").append(colKey[j]).attr("colspan", x * valsCount);
          if (parseInt(j) === colAttrs.length - 1 && rowAttrs.length !== 0) {
            th.attr("rowspan", col_rowspan);
          }
          tr.append(th);
        }
      }
      if (parseInt(j) === 0) {
        tr.append($("<th class='pvtTotalLabel'>").text(opts.localeStrings.totals).attr("colspan", col_colspan).attr("rowspan", col_rowspan));
      }
      result.append(tr);
    }
    if (rowAttrs.length !== 0) {
      tr = $("<tr>");
      for (i in rowAttrs) {
        if (!__hasProp.call(rowAttrs, i)) continue;
        r = rowAttrs[i];
        tr.append($("<th class='pvtAxisLabel'>").text(r));
      }
      if (colAttrs.length > 0) {
        th = $("<th>");
        tr.append(th);
      }
      val = pivotData.valAttrs;
      for (i in colKeys) {
        if (!__hasProp.call(colKeys, i)) continue;
        colKey = colKeys[i];
        for (v in val) {
          if (!__hasProp.call(val, v)) continue;
          vKey = val[v];
          tr.append($("<th class='pvtColLabel'>").append(vKey).data("value", vKey));
        }
      }
      for (v in val) {
        if (!__hasProp.call(val, v)) continue;
        vKey = val[v];
        tr.append($("<th class='pvtColLabel'>").append(vKey).data("value", vKey));
      }
      result.append(tr);
    }
    for (i in rowKeys) {
      if (!__hasProp.call(rowKeys, i)) continue;
      rowKey = rowKeys[i];
      tr = $("<tr>");
      for (j in rowKey) {
        if (!__hasProp.call(rowKey, j)) continue;
        txt = rowKey[j];
        x = spanSize(rowKeys, parseInt(i), parseInt(j));
        if (x !== -1) {
          th = $("<th class='pvtRowLabel'>").text(txt).attr("rowspan", x);
          if (parseInt(j) === rowAttrs.length - 1 && colAttrs.length !== 0) {
            th.attr("colspan", 2);
          }
          tr.append(th);
        }
      }
      for (j in colKeys) {
        if (!__hasProp.call(colKeys, j)) continue;
        colKey = colKeys[j];
        xx = 0;
        while (xx < pivotData.aggregatorKeys.length) {
          aggregator = pivotData.getAggregator(rowKey, colKey, xx);
          val = aggregator.value(xx);
          tr.append($("<td class='pvtVal row" + i + " col" + j + "'>").html(aggregator.format(val)).data("value", val));
          xx++;
        }
      }
      xx = 0;
      while (xx < pivotData.aggregatorKeys.length) {
        totalAggregator = pivotData.getAggregator(rowKey, [], xx);
        val = totalAggregator.value(xx);
        tr.append($("<td class='pvtTotal rowTotal'>").html(totalAggregator.format(val)).data("value", val).data("for", "row" + i));
        xx++;
      }
      result.append(tr);
    }
    tr = $("<tr>");
    th = $("<th class='pvtTotalLabel'>").text(opts.localeStrings.totals);
    th.attr("colspan", rowAttrs.length + (colAttrs.length === 0 ? 0 : 1));
    tr.append(th);
    for (j in colKeys) {
      if (!__hasProp.call(colKeys, j)) continue;
      colKey = colKeys[j];
      xx = 0;
      while (xx < pivotData.aggregatorKeys.length) {
        totalAggregator = pivotData.getAggregator([], colKey, xx);
        val = totalAggregator.value(xx);
        tr.append($("<td class='pvtTotal colTotal'>").html(totalAggregator.format(val)).data("value", val).data("for", "col" + j));
        xx++;
      }
    }
    xx = 0;
    while (xx < pivotData.aggregatorKeys.length) {
      totalAggregator = pivotData.getAggregator([], [], xx);
      val = totalAggregator.value(xx);
      tr.append($("<td class='pvtGrandTotal'>").html(totalAggregator.format(val)).data("value", val));
      xx++;
    }
    result.append(tr);
    result.data("dimensions", [rowKeys.length, colKeys.length]);
    return result;
  };

  /*
  Pivot Table
  */


  $.fn.pivot = function(input, opts) {
    var defaults, pivotData, result;
    defaults = {
      cols: [],
      rows: [],
      vals: [],
      aggregatorKeys: [],
      filter: function() {
        return true;
      },
      aggregator: aggregators.count(),
      derivedAttributes: {},
      renderer: pivotTableRenderer,
      rendererOptions: null,
      localeStrings: {
        renderError: "An error occurred rendering the PivotTable results.",
        computeError: "An error occurred computing the PivotTable results."
      }
    };
    opts = $.extend(defaults, opts);
    result = null;
    try {
      if (opts.aggregatorKeys.length <= 0) {
        opts.aggregator[0] = aggregators.count();
      }
      pivotData = getPivotData(input, opts.cols, opts.rows, opts.vals, opts.aggregator, opts.aggregatorKeys, opts.filter, opts.derivedAttributes);
      try {
        result = opts.renderer(pivotData, opts.rendererOptions);
      } catch (e) {
        if (typeof console !== "undefined" && console !== null) {
          console.error(e.stack);
        }
        result = opts.localeStrings.renderError;
      }
    } catch (e) {
      if (typeof console !== "undefined" && console !== null) {
        console.error(e.stack);
      }
      result = opts.localeStrings.computeError;
    }
    this.html(result);
    return this;
  };

  /*
  UI code, calls pivot table above
  */


  $.fn.pivotUI = function(input, inputOpts, overwrite) {
    var aggregator, axisValues, buttonCompare, c, colList, defaults, existingOpts, i, k, opts, pivotTable, refresh, renderer, rendererControl, selectCompare1, selectCompare2, selectCompareControl, shownAttributes, tblCols, tr1, tr2, tr3, uiTable, x, _fn, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _ref, _ref1, _ref2, _ref3, _ref4, _ref5,
      _this = this;
    if (overwrite == null) {
      overwrite = false;
    }
    defaults = {
      derivedAttributes: {},
      aggregators: aggregators,
      renderers: renderers,
      hiddenAttributes: [],
      menuLimit: 200,
      tblCols: [],
      cols: [],
      rows: [],
      vals: [],
      aggregatorKeys: [],
      exclusions: {},
      unusedAttrsVertical: false,
      autoSortUnusedAttrs: false,
      rendererOptions: null,
      onRefresh: null,
      filter: function() {
        return true;
      },
      localeStrings: {
        renderError: "An error occurred rendering the PivotTable results.",
        computeError: "An error occurred computing the PivotTable results.",
        uiRenderError: "An error occurred rendering the PivotTable UI.",
        selectAll: "Select All",
        selectNone: "Select None",
        tooMany: "(too many to list)"
      }
    };
    existingOpts = this.data("pivotUIOptions");
    if (!(existingOpts != null) || overwrite) {
      opts = $.extend(defaults, inputOpts);
    } else {
      opts = existingOpts;
    }
    try {
      input = convertToArray(input);
      tblCols = (function() {
        var _ref, _results;
        _ref = input[0];
        _results = [];
        for (k in _ref) {
          if (!__hasProp.call(_ref, k)) continue;
          _results.push(k);
        }
        return _results;
      })();
      _ref = opts.derivedAttributes;
      for (c in _ref) {
        if (!__hasProp.call(_ref, c)) continue;
        if ((__indexOf.call(tblCols, c) < 0)) {
          tblCols.push(c);
        }
      }
      axisValues = {};
      for (_i = 0, _len = tblCols.length; _i < _len; _i++) {
        x = tblCols[_i];
        axisValues[x] = {};
      }
      opts.tblCols = tblCols;
      axisValues = {};
      for (_j = 0, _len1 = tblCols.length; _j < _len1; _j++) {
        x = tblCols[_j];
        axisValues[x] = {};
      }
      forEachRecord(input, opts.derivedAttributes, function(record) {
        var v, _base, _ref1, _results;
        _results = [];
        for (k in record) {
          if (!__hasProp.call(record, k)) continue;
          v = record[k];
          if (v == null) {
            v = "null";
          }
          if ((_ref1 = (_base = axisValues[k])[v]) == null) {
            _base[v] = 0;
          }
          _results.push(axisValues[k][v]++);
        }
        return _results;
      });
      uiTable = $("<table class='table table-bordered' cellpadding='5'>");
      rendererControl = $("<td>");
      renderer = $("<select class='pvtRenderer'>").bind("change", function() {
        return refresh();
      });
      _ref1 = opts.renderers;
      for (x in _ref1) {
        if (!__hasProp.call(_ref1, x)) continue;
        renderer.append($("<option>").val(x).text(x));
      }
      rendererControl.append(renderer);
      colList = $("<td class='pvtAxisContainer pvtUnused'>");
      if (opts.unusedAttrsVertical) {
        colList.addClass('pvtVertList');
      } else {
        colList.addClass('pvtHorizList');
      }
      shownAttributes = (function() {
        var _k, _len2, _results;
        _results = [];
        for (_k = 0, _len2 = tblCols.length; _k < _len2; _k++) {
          c = tblCols[_k];
          if (__indexOf.call(opts.hiddenAttributes, c) < 0) {
            _results.push(c);
          }
        }
        return _results;
      })();
      _fn = function(c) {
        var attrElem, btns, filterItem, filterItemExcluded, hasExcludedItem, keys, v, valueList, _k, _len2, _ref2;
        keys = (function() {
          var _results;
          _results = [];
          for (k in axisValues[c]) {
            _results.push(k);
          }
          return _results;
        })();
        hasExcludedItem = false;
        valueList = $("<div>").addClass('pvtFilterBox').css({
          "z-index": 100,
          "width": "280px",
          "height": "350px",
          "overflow": "scroll",
          "border": "1px solid gray",
          "background": "white",
          "display": "none",
          "position": "absolute",
          "padding": "20px"
        });
        valueList.append($("<div>").css({
          "text-align": "center",
          "font-weight": "bold"
        }).text("" + c + " (" + keys.length + ")"));
        if (keys.length > opts.menuLimit) {
          valueList.append($("<p>").css({
            "text-align": "center"
          }).text(opts.localeStrings.tooMany));
        } else {
          btns = $("<p>").css({
            "text-align": "center"
          });
          btns.append($("<button>").text(opts.localeStrings.selectAll).bind("click", function() {
            return valueList.find("input").prop("checked", true);
          }));
          btns.append($("<button>").text(opts.localeStrings.selectNone).bind("click", function() {
            return valueList.find("input").prop("checked", false);
          }));
          valueList.append(btns);
          _ref2 = keys.sort(naturalSort);
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            k = _ref2[_k];
            v = axisValues[c][k];
            filterItem = $("<label>");
            filterItemExcluded = opts.exclusions[c] ? (__indexOf.call(opts.exclusions[c], k) >= 0) : false;
            hasExcludedItem || (hasExcludedItem = filterItemExcluded);
            filterItem.append($("<input type='checkbox' class='pvtFilter'>").attr("checked", !filterItemExcluded).data("filter", [c, k]));
            filterItem.append($("<span>").text("" + k + " (" + v + ")"));
            valueList.append($("<p>").append(filterItem));
          }
        }
        attrElem = $("<li class='label label-info axis_" + i + "'>").append($("<div class='div_axis_" + i + "'>").append($("<nobr>").text(c)));
        if (hasExcludedItem) {
          attrElem.addClass('pvtFilteredAttribute');
        }
        colList.append(attrElem).append(valueList);
        return attrElem.bind("dblclick", function(e) {
          valueList.css({
            left: e.pageX,
            top: e.pageY
          }).toggle();
          valueList.bind("click", function(e) {
            return e.stopPropagation();
          });
          return $(document).one("click", function() {
            var unselectedCount;
            unselectedCount = $(valueList).find("[type='checkbox']").length - $(valueList).find("[type='checkbox']:checked").length;
            if (unselectedCount > 0) {
              attrElem.addClass("pvtFilteredAttribute");
            } else {
              attrElem.removeClass("pvtFilteredAttribute");
            }
            refresh();
            return valueList.toggle();
          });
        });
      };
      for (i in shownAttributes) {
        c = shownAttributes[i];
        _fn(c);
      }
      aggregator = $("<select class='pvtAggregator'>").css("margin-bottom", "5px").bind("change", function() {
        return refresh();
      });
      _ref2 = opts.aggregators;
      for (x in _ref2) {
        if (!__hasProp.call(_ref2, x)) continue;
        aggregator.append($("<option>").val(x).text(x));
      }
      selectCompareControl = $("<td>");
      selectCompare1 = $("<select class='toCompare1'>");
      selectCompare2 = $("<select class='toCompare2'>");
      buttonCompare = $("<button class='toComparebtn'>").text("Agregar").bind("click", function() {
        var cantidadCampos, cuentaSelect, newVal, optionSelected1, optionSelected2, selectCompare;
        optionSelected1 = $(".toCompare1 option:selected");
      //  optionSelected2 = $(".toCompare2 option:selected");
        cantidadCampos = $(".pvtAxisContainer").find("li").length;
        ++cantidadCampos;
        cuentaSelect = $(event.target).find("select").length;
        ++cuentaSelect;
        selectCompare = $("<select class='pvtAggregator" + (++cuentaSelect) + "'>");
        $.each(opts.aggregators, function(key, value) {
          if (key.toUpperCase().indexOf("COMPARE") >= 0) {
            return selectCompare.append($("<option>").val(key).text(key));
          }
        });
        selectCompare.val("compareWith").attr("disabled", true);
        newVal = $("<li class='label label-info axis_" + cantidadCampos + "'>").append($("<div class='div_axis_" + cantidadCampos + "'>"));
        newVal.append($("<nobr>").text(optionSelected1.text()));
        newVal.append(selectCompare);
        $(".pvtVals").append(newVal);
        return refresh();
      });
      for (i in shownAttributes) {
        x = shownAttributes[i];
        selectCompare1.append($("<option>").val(x).text(x));
       // selectCompare2.append($("<option>").val(x).text(x));
      }
      selectCompareControl.append($("<nobr>").text("Campo 1")).append(selectCompare1);
      //selectCompareControl.append($("<nobr>").text("Campo 2")).append(selectCompare2);
      selectCompareControl.append(buttonCompare);
      tr2 = $("<tr>");
      tr2.append($("<td class='pvtAxisContainer pvtHorizList pvtVals'>").css("text-align", "center"));
      tr2.append($("<td  class='pvtAxisContainer pvtHorizList pvtCols'>"));
      uiTable.append(tr2);
      tr3 = $("<tr>");
      tr3.append($("<td valign='top' class='pvtAxisContainer pvtRows'>"));
      pivotTable = $("<td valign='top' class='pvtRendererArea'>");
      tr3.append(pivotTable);
      uiTable.append(tr3);
      if (opts.unusedAttrsVertical) {
        uiTable.find('tr:nth-child(1)').prepend(selectCompareControl);
        uiTable.find('tr:nth-child(2)').prepend(colList.css('vertical-align', 'top'));
      } else {
        uiTable.prepend($("<tr>").append(selectCompareControl).append(colList));
      }
      tr1 = $("<tr>");
      tr1.append(rendererControl);
      uiTable.prepend(tr1);
      this.html(uiTable);
      _ref3 = opts.cols;
      for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
        x = _ref3[_k];
        this.find(".pvtCols").append(this.find(".axis_" + (shownAttributes.indexOf(x))));
      }
      _ref4 = opts.rows;
      for (_l = 0, _len3 = _ref4.length; _l < _len3; _l++) {
        x = _ref4[_l];
        this.find(".pvtRows").append(this.find(".axis_" + (shownAttributes.indexOf(x))));
      }
      _ref5 = opts.vals;
      for (_m = 0, _len4 = _ref5.length; _m < _len4; _m++) {
        x = _ref5[_m];
        this.find(".pvtVals").append(this.find(".axis_" + (shownAttributes.indexOf(x))));
      }
      if (opts.aggregatorName != null) {
        this.find(".pvtAggregator").val(opts.aggregatorName);
      }
      if (opts.rendererName != null) {
        this.find(".pvtRenderer").val(opts.rendererName);
      }
      refresh = function() {
        var exclusions, natSort, subopts, unusedAttrsContainer, vals;
        subopts = {
          derivedAttributes: opts.derivedAttributes,
          localeStrings: opts.localeStrings,
          rendererOptions: opts.rendererOptions,
          aggregator: [],
          cols: [],
          rows: [],
          vals: [],
          aggregatorKeys: []
        };
        vals = [];
        _this.find(".pvtRows li nobr").each(function() {
          return subopts.rows.push($(this).text());
        });
        _this.find(".pvtCols li nobr").each(function() {
          return subopts.cols.push($(this).text());
        });
        _this.find(".pvtVals li nobr").each(function() {
          return subopts.vals.push($(this).text());
        });
        _this.find(".pvtVals li select option:selected").each(function() {
          return subopts.aggregatorKeys.push($(this).text());
        });
        i = 0;
        while (i < subopts.aggregatorKeys.length) {
          subopts.aggregator[i] = opts.aggregators[subopts.aggregatorKeys[i]](subopts.vals, i);
          i++;
        }
        subopts.renderer = opts.renderers[renderer.val()];
        exclusions = {};
        _this.find('input.pvtFilter').not(':checked').each(function() {
          var filter;
          filter = $(this).data("filter");
          if (exclusions[filter[0]] != null) {
            return exclusions[filter[0]].push(filter[1]);
          } else {
            return exclusions[filter[0]] = [filter[1]];
          }
        });
        subopts.filter = function(record) {
          var excludedItems, _ref6;
          if (!opts.filter(record)) {
            return false;
          }
          for (k in exclusions) {
            excludedItems = exclusions[k];
            if (_ref6 = record[k], __indexOf.call(excludedItems, _ref6) >= 0) {
              return false;
            }
          }
          return true;
        };
        pivotTable.pivot(input, subopts);
        _this.data("pivotUIOptions", {
          cols: subopts.cols,
          rows: subopts.rows,
          vals: subopts.vals,
          exclusions: exclusions,
          hiddenAttributes: opts.hiddenAttributes,
          renderers: opts.renderers,
          aggregators: opts.aggregators,
          derivedAttributes: opts.derivedAttributes,
          aggregatorName: aggregator.val(),
          rendererName: renderer.val(),
          localeStrings: opts.localeStrings,
          rendererOptions: opts.rendererOptions
        });
        if (opts.autoSortUnusedAttrs) {
          natSort = $.pivotUtilities.naturalSort;
          unusedAttrsContainer = _this.find("td.pvtUnused.pvtAxisContainer");
          $(unusedAttrsContainer).children("li").sort(function(a, b) {
            return natSort($(a).text(), $(b).text());
          }).appendTo(unusedAttrsContainer);
        }
        if (opts.onRefresh != null) {
          return opts.onRefresh();
        }
      };
      refresh();
      this.find(".pvtAxisContainer").sortable({
        connectWith: this.find(".pvtAxisContainer"),
        items: 'li',
        receive: function(event, ui) {
          var cuentaSelect, select;
          ui.item.find("select").remove();
          i = 0;
          ui.item.find("div").each(function() {
            if (i > 0) {
              $(this).remove();
            }
            return i++;
          });
          if (event.target.className.toUpperCase().indexOf("VALS") >= 0) {
            cuentaSelect = 0;
            $(event.target).find("select").each(function() {
              return ++cuentaSelect;
            });
            select = $("<select class='pvtAggregator" + (++cuentaSelect) + "'>").bind("change", function() {
              var aggregatorSelected, newItemConSelect, newSelect;
              if ($(this).val() === "sum" || $(this).val() === "count") {
                i = 0;
                $(this).parent().parent().children("div").each(function() {
                  if (i !== 0) {
                    $(this).remove();
                  }
                  return i++;
                });
                newItemConSelect = $(this).parent().clone();
                newSelect = newItemConSelect.children("select");
                newSelect.find("option").remove();
                newSelect.bind("change", function() {
                  return refresh();
                });
                aggregatorSelected = $(this).val();
//                $.each(opts.aggregators, function(key, value) {
//                  if ((aggregatorSelected === "sum" && key.toUpperCase().indexOf("SUMASFRACTION") >= 0) || (aggregatorSelected === "count" && key.toUpperCase().indexOf("COUNTASFRACTION") >= 0)) {
//                    return newSelect.append($("<option>").val(key).text(key));
//                  }
//                });
                newItemConSelect.appendTo($(this).parents("li").get(0));
              }
              return refresh();
            });
            $.each(opts.aggregators, function(key, value) {
              if (!(key.toUpperCase().indexOf("ASFRACTION") > 0 || key.toUpperCase().indexOf("COMPARE") > 0)) {
                return select.append($("<option>").val(key).text(key));
              }
            });
            return $("." + ui.item[0].className.replace(/\s/g, '.') + " div").append(select);
          }
        }
      }).bind("sortstop", refresh);
    } catch (e) {
      if (typeof console !== "undefined" && console !== null) {
        console.error(e.stack);
      }
      this.html(opts.localeStrings.uiRenderError);
    }
    return this;
  };

  /*
  Heatmap post-processing
  */


  $.fn.heatmap = function(scope) {
    var colorGen, heatmapper, i, j, numCols, numRows, _i, _j, _ref,
      _this = this;
    if (scope == null) {
      scope = "heatmap";
    }
    _ref = this.data("dimensions"), numRows = _ref[0], numCols = _ref[1];
    colorGen = function(color, min, max) {
      var hexGen;
      hexGen = (function() {
        switch (color) {
          case "red":
            return function(hex) {
              return "ff" + hex + hex;
            };
          case "green":
            return function(hex) {
              return "" + hex + "ff" + hex;
            };
          case "blue":
            return function(hex) {
              return "" + hex + hex + "ff";
            };
        }
      })();
      return function(x) {
        var hex, intensity;
        intensity = 255 - Math.round(255 * (x - min) / (max - min));
        hex = intensity.toString(16).split(".")[0];
        if (hex.length === 1) {
          hex = 0 + hex;
        }
        return hexGen(hex);
      };
    };
    heatmapper = function(scope, color) {
      var colorFor, forEachCell, values;
      forEachCell = function(f) {
        return _this.find(scope).each(function() {
          var x;
          x = $(this).data("value");
          if ((x != null) && isFinite(x)) {
            return f(x, $(this));
          }
        });
      };
      values = [];
      forEachCell(function(x) {
        return values.push(x);
      });
      colorFor = colorGen(color, Math.min.apply(Math, values), Math.max.apply(Math, values));
      return forEachCell(function(x, elem) {
        return elem.css("background-color", "#" + colorFor(x));
      });
    };
    switch (scope) {
      case "heatmap":
        heatmapper(".pvtVal", "red");
        break;
      case "rowheatmap":
        for (i = _i = 0; 0 <= numRows ? _i < numRows : _i > numRows; i = 0 <= numRows ? ++_i : --_i) {
          heatmapper(".pvtVal.row" + i, "red");
        }
        break;
      case "colheatmap":
        for (j = _j = 0; 0 <= numCols ? _j < numCols : _j > numCols; j = 0 <= numCols ? ++_j : --_j) {
          heatmapper(".pvtVal.col" + j, "red");
        }
    }
    heatmapper(".pvtTotal.rowTotal", "red");
    heatmapper(".pvtTotal.colTotal", "red");
    return this;
  };

  /*
  Barchart post-processing
  */


  $.fn.barchart = function() {
    var barcharter, i, numCols, numRows, _i, _ref,
      _this = this;
    _ref = this.data("dimensions"), numRows = _ref[0], numCols = _ref[1];
    barcharter = function(scope) {
      var forEachCell, max, scaler, values;
      forEachCell = function(f) {
        return _this.find(scope).each(function() {
          var x;
          x = $(this).data("value");
          if ((x != null) && isFinite(x)) {
            return f(x, $(this));
          }
        });
      };
      values = [];
      forEachCell(function(x) {
        return values.push(x);
      });
      max = Math.max.apply(Math, values);
      scaler = function(x) {
        return 100 * x / (1.4 * max);
      };
      return forEachCell(function(x, elem) {
        var text, wrapper;
        text = elem.text();
        wrapper = $("<div>").css({
          "position": "relative",
          "height": "55px"
        });
        wrapper.append($("<div>").css({
          "position": "absolute",
          "bottom": 0,
          "left": 0,
          "right": 0,
          "height": scaler(x) + "%",
          "background-color": "gray"
        }));
        wrapper.append($("<div>").text(text).css({
          "position": "relative",
          "padding-left": "5px",
          "padding-right": "5px"
        }));
        return elem.css({
          "padding": 0,
          "padding-top": "5px",
          "text-align": "center"
        }).html(wrapper);
      });
    };
    for (i = _i = 0; 0 <= numRows ? _i < numRows : _i > numRows; i = 0 <= numRows ? ++_i : --_i) {
      barcharter(".pvtVal.row" + i);
    }
    barcharter(".pvtTotal.colTotal");
    return this;
  };

}).call(this);
