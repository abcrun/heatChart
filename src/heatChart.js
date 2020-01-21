/**
 * @license MIT
 * @author Bruce Yang(https://github.com/abcrun/heatChart)
 **/
(function(root, factory){
  if(typeof define === 'function' && define.amd) define(factory);//AMD
  else if(typeof module === 'object' && module.exports) module.exports = factory();//CommonJS
  else root.heatChart = factory();
})(this, function(){
  //计算offset
  var offset = function(elm){
    var left = elm.offsetLeft, top = elm.offsetTop;
    while(elm.offsetParent){
      var elm = elm.offsetParent;
      left += elm.offsetLeft;
      top += elm.offsetTop;
    }
    return { left: left, top: top }
  }

  //处理颜色
  var createColors = function(colors){
    var canvas = document.createElement('canvas'), context = canvas.getContext('2d'),
      width = 256, height = 10;

    canvas.width = width
    canvas.height = height;

    var linear = context.createLinearGradient(0, 0, width, height);
    for(key in colors){
      linear.addColorStop(key, colors[key]);
    }

    context.fillStyle = linear;
    context.fillRect(0,0, width, height)

    return context.getImageData(0, 0, width, 1).data;
  }

  //处理数据
  var formatData = function(data, width, height, radius){
    var datas = [], data = data || [], max = 0, min = 0, unit = 2*radius;
    if(!data.length){
      return { list: [], max: 0, min: 0 }
    }

    var ispercent = (data[0].xCoord || data[0].x) < 1;
    data.forEach(function(d){
      var x = d.x || d.xCoord, y = d.y || d.yCoord, value = d.value || d.hotValue;

      x = Math.ceil((ispercent ? x*width : x)/unit);
      y = Math.ceil((ispercent ? y*height : y)/unit);

      if(value > max) max = value;
      if(value < min) min = value;
      if(!datas[y]) datas[y] = [];
      d.x = x*unit;
      d.y = y*unit;
      d.value = value;

      var exist = datas[y][x];
      datas[y][x] = exist && exist.value > d.value ? exist : d;
    })

    return { list: datas, min: min, max: max };
  }

  //画灰度层
  var drawGrayLayout = function(d, alpha, radius, ctx){
    var x = d.x, y = d.y, value = d.value;
    ctx.beginPath();
    ctx.arc(x, y, radius*1.2, 0, Math.PI*2);
    ctx.closePath();

    var gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(.5, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }

  //填充颜色
  var fillColor = function(ctx, width, height, colors){
    var imageData = ctx.getImageData(0, 0, width, height), data = imageData.data;

    for(var i = 3; i < data.length; i +=4){
      var alpha = data[i], color = colors.slice(alpha*4, alpha*4 + 3);
      data[i - 3] = color[0];
      data[i - 2] = color[1];
      data[i - 1] = color[2];
    }
    ctx.putImageData(imageData, 0, 0, 0, 0, width, height);
  }

  //绑定事件
  var bindEvent = function(){
    var that = this, g = this.gesture;

    g.addEvent('tap', function(opt, endInfo, startInfo){
      var wrapper = that.element, data = (that.data || {}).list, end = endInfo.event.changedTouches[0];
      var pos = offset(wrapper), left = pos.left, top = pos.top;
      var px = end.pageX, py = end.pageY, tx = opt.tx, ty = opt.ty, scale = opt.scale,
        x = (px - left - tx)/scale, y = (py - top - ty)/scale, length = Math.ceil(1/scale/2),
        radius = that.radius,
        unit = 2*radius, i = Math.ceil(y/unit), j = Math.ceil(x/unit);

      if(!data) return;
      var max = 0, select;
      for(var m = i - length; m < i + length; m++){
        for(var n = j - length; n < j + length; n++){
          var d = data[m];
          if(!d) continue;
          d = d[n]
          if(!d) continue;

          var value = d.value;
          if(value > max){
            max = value;
            select = d;
          }
        }
      }

      that.events['tap'] && that.events['tap'].call(that, select, px, py, opt);
    })

    g.addEvent('slide', function(){
      that.events['slide'] && that.events['slide'].apply(that, arguments)
    })

    g.addEvent('pinch', function(){
      that.events['pinch'] && that.events['pinch'].apply(that, arguments)
    })

  }

  function Chart(elm, colors, radius, autoscale){
    var element = document.createElement('div'),
      back = document.createElement('canvas'), front = document.createElement('canvas'),
      backCtx = back.getContext('2d'), frontCtx = front.getContext('2d');

    element.appendChild(back)
    element.appendChild(front)
    elm.appendChild(element)

    var g = new Gesture(element);
    autoscale && g.enable('slide', 'pinch')

    this.element = elm;
    this.container = element; //热力图容器
    this.canvas = { front: front, back: back }; //背景层和热力层
    this.context = { front: frontCtx, back: backCtx };
    this.offset = { width: 0, height: 0 }; //热力图绘制原始大小
    this.colors = createColors(colors || { 0: 'yellow', 1: 'red' }); //色值
    this.autoscale = autoscale || false; //是否根据容器大小自动缩放
    this.radius = radius || 12;
    this.renderRadius = this.radius;//根据不同的scale来计算圆的半径
    this.image = null; //背景图
    this.data = null; //数据
    this.filter = null; //过滤数据
    this.gesture = g;
    this.events = {};

    bindEvent.call(this);
  }

  Chart.prototype = {
    clear: function(){
      var fctx = this.context.front, bctx = this.context.back,
        front = this.canvas.front, width = front.width, height = front.height;
      fctx.clearRect(0, 0, width, height);
      bctx.clearRect(0, 0, width, height);
    },
    setOptions: function(options){
      var that = this, element = this.element, container = this.container,
        front = this.canvas.front, back = this.canvas.back,
        autoscale = this.autoscale, radius = this.radius, image = this.image || new Image();

      var width = options.width || this.offset.width || element.offsetWidth, height = options.height || this.offset.height || element.offsetHeight,
        url = options.url,  data = options.data, filter = options.filter;

      this.image = image;
      this.offset = { width: width, height: height }
      //原始radius格式化数据，根据scale换算出来的数据画点
      this.data = formatData(data, width, height, radius);
      this.filter = filter ? filter : (data ? [this.data.min, this.data.max] : this.filter);

      if(url){
        image.src = url;
        image.onload = function(){
          var w = this.width, h = this.height,
            wscale = width/w, hscale = height/h,
            scale = wscale < hscale ? wscale : hscale,
            css = 'width:' + w + 'px' + ';height:' + h + 'px;',
            tx = (width - w*scale)/2/scale, ty = (height - h*scale)/2/scale,
            containercss = 'position:relative;transform-origin:0 0;' + (autoscale ? css + 'transform: scale3d(' + scale + ',' + scale + ', 1) translate3d(' + tx +'px,' + ty + 'px,0)' : css);
          container.style.cssText = containercss;
          front.style.cssText = back.style.cssText = css + 'position:absolute;top:0;left:0;'
          front.width = back.width = w;
          front.height = back.height = h;

          that.renderRadius = radius/scale;


          autoscale && that.gesture.setOption({minScale: scale})

          that.render();
        }
      }else{
        this.render();
      }

    },
    render: function(){
      var that = this, data = this.data, list = data.list, filter = this.filter || [0, 0], min = filter[0], max = filter[1],
        width = this.image.width, height = this.image.height, radius = this.renderRadius, colors = this.colors,
        bctx = this.context.back, ctx = this.context.front;

      this.clear();
      if(this.image.complete){
        bctx.drawImage(this.image, 0, 0, width, height);

        list.forEach(function(l){
          if(!l.length) return;
          l.forEach(function(d){
            if(!d || d.value < min || d.value > max) return;

            var alpha;
            if(max == min && max != 0) alpha = 1;
            else alpha = (d.value - min) / (max - min)
            drawGrayLayout(d, alpha, radius, ctx);
          })
        })

        fillColor(ctx, width, height, colors);

        this.events['render'] && this.events['render'].call(this);
      }else{
        var i = 0;
        setTimeout(function(){
          if(i <= 50) that.render();
          else{
            i = 0;
            throw new Error('load url error');
          }
        }, 200)
      }
    },
    setFilter: function(range){
      this.filter = range;
      this.render();
    },
    addEvent: function(name, fn){//render, tap, slide, rotate
      var fn = fn || function(){};
      this.events[name] = fn;
    },
    removeEvent: function(name){
      delete this.events[name];
    }
  }

  return {
    create:function(options){
      var element = options.element, colors = options.colors, radius = options.radius, autoscale = options.autoscale;
      if(!element) throw new Error('need options.element')

      return new Chart(element, colors, radius, autoscale);
    }
  };
})
