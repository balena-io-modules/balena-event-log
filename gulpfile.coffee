path = require('path')
gulp = require('gulp')
gutil = require('gulp-util')
coffee = require('gulp-coffee')
runSequence = require('run-sequence')

OPTIONS =
	config:
		coffeelint: path.join(__dirname, 'coffeelint.json')
	files:
		coffee: [ 'src/*.coffee' ]
		app: 'src/*.coffee'
		javascript: 'bin/*.js'
	directories:
		build: './bin'

gulp.task 'coffee', ->
	gulp.src(OPTIONS.files.app)
		.pipe(coffee()).on('error', gutil.log)
		.pipe(gulp.dest(OPTIONS.directories.build))

gulp.task 'build', (callback) ->
	runSequence([ 'coffee' ], callback)

gulp.task 'watch', [ 'build' ], ->
	gulp.watch([ OPTIONS.files.coffee ], [ 'build' ])