var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var ts = require('gulp-typescript');
var babel = require('gulp-babel');

var tsProject = ts.createProject('./tsconfig.json', {
  typescript: require('typescript')
});

gulp.task('default', function() {
  return gulp.src('app/**/*.ts')
    .pipe(sourcemaps.init())
    .pipe(ts(tsProject))
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('release'));
});