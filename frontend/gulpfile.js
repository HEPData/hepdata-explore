var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var ts = require('gulp-typescript');
var babel = require('gulp-babel');
var replace = require('gulp-replace');
var rjs = require('gulp-requirejs-optimize');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var pump = require('pump');

var tsProject = ts.createProject('./tsconfig.json', {
  typescript: require('typescript')
});

gulp.task('typescript', function () {
  return gulp.src('app/**/*.ts')
    .pipe(sourcemaps.init())
    .pipe(ts(tsProject))
    .pipe(babel())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('build-compat'))
});

gulp.task('bundle', ['typescript'], function () {
  return gulp.src('build-compat/bootstrap.js')
    .pipe(rjs({
      name: 'bootstrap',
      baseUrl: 'build-compat/',
      out: 'hepdata-explore.js',
      optimize: 'none',
    }))
    .pipe(gulp.dest('release/'))
});

gulp.task('minify', ['bundle'], function (cb) {
  pump([
    gulp.src('release/hepdata-explore.js'),
    sourcemaps.init(),
    uglify(),
    rename({suffix: '.min'}),
    sourcemaps.write('.'),
    gulp.dest('release'),
  ], cb);
})

gulp.task('production-replace', function () {
  //
});

gulp.task('default', ['typescript', 'bundle', 'minify']);