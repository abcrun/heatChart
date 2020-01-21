var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

gulp.task('default', function(){
  return gulp.src(['src/gesture.min.js', 'src/heatChart.js'])
    .pipe(
      uglify({
        mangle: true,
        compress: true,
        output: {
          comments:/@license/
        }
      })
    )
    .pipe(concat('heatchart.min.js'))
    .pipe(gulp.dest('dist'));
})
