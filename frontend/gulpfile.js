var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var ts = require('gulp-typescript');
var babel = require('gulp-babel');
var replace = require('gulp-replace');
var rjs = require('gulp-requirejs-optimize');
var uglify = require('gulp-uglify-cli');
var rename = require('gulp-rename');
var pump = require('pump');
var htmlreplace = require('gulp-html-replace');

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
    uglify('--screw-ie8'),
    rename({suffix: '.min'}),
    gulp.dest('release'),
  ], cb);
})

gulp.task('replace', function () {
  gulp.src(['index.html'])
    .pipe(htmlreplace({
      bundle: {
        src: 'release/hepdata-explore.js',
        tpl: '<script src="%s"></script>',
      }
    }))
    .pipe(replace(/\.js"/g, '.min.js"'))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('.'));
});

gulp.task('default', ['typescript', 'bundle', 'minify', 'replace']);