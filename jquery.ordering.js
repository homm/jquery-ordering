
(function($){

	function nearestFinder ($targets) {
		this.$targets = $targets;
		this.last_nearest = false;
	}
	nearestFinder.prototype.update = function(){
		var rows = {};
		var parents = [];

		this.$targets.each(function(i){
			var offset = $(this).offset();
			var idx = 'top_' + offset.top.toString();
			if ( ! (idx in rows)) {
				rows[idx] = {'elements': [], y: offset.top};
			}
			rows[idx].elements.push({x: offset.left + this.offsetWidth/2, element: this});
		});

		this.rows = rows;
	}
	nearestFinder.prototype.getNearest = function(x, y) {
		var min_distance = false;
		var nearest_row = false;
		var rows = this.rows;

		for (idx in rows) {
			var distance = Math.abs(rows[idx].y - y);
			if (min_distance === false || distance < min_distance) {
				min_distance = distance;
				nearest_row = rows[idx].elements;
			}
		}

		var min_distance = Math.abs(nearest_row[0].x - x);
		var nearest = nearest_row[0].element;
		for (var i = 1; i < nearest_row.length; i++) {
			var distance = Math.abs(nearest_row[i].x - x);
			if (distance < min_distance) {
				min_distance = distance;
				nearest = nearest_row[i].element;
			}
		}

		return $(nearest);
	}
	nearestFinder.prototype.getNearestNotLast = function(x, y) {
		var nearest = this.getNearest(x, y);

		if (this.last_nearest && nearest && this.last_nearest[0] == nearest[0]) {
			return false;
		}

		return this.last_nearest = nearest;
	}
	nearestFinder.prototype.resetLast = function() {
		this.last_nearest = false;
	}

	$.nearestFinder = function ($targets) {
		return new nearestFinder($targets);
	}


	$.fn.extend({
		moveable: function(options) {
			var defaults = {
				'offsetX': 4,
				'offsetY': 4,
				'only_left': true,
				'zIndex': 100,
				'dragged_class': 'ui-moved',
				'fake_class': 'ui-moved-fake',
				'start': $.noop,
				'move': $.noop,
				'finish': $.noop
			};
			options = $.extend({}, defaults, options);

			var dragged = false;

			function fixTouch(e) {
				if (e.originalEvent.touches) {
					e.pageX = e.originalEvent.touches[0].pageX;
					e.pageY = e.originalEvent.touches[0].pageY;
					e.which = 1;
				}
			}

			this.bind('mousedown.moveable touchstart.movable', function(down_e){
					fixTouch(down_e);
					if (options.only_left && down_e.which != 1) {
						return;
					}
					var $dragged = $(down_e.currentTarget);
					var $fake = false;
					var dragged_pos = $dragged.position();
					var dragged_offset = $dragged.offset();

					$(document)
						.bind('mousemove.moveable touchmove.movable', function(move_e){
							fixTouch(move_e);
							if ( ! dragged && (Math.abs(move_e.pageX - down_e.pageX) > options.offsetX || Math.abs(move_e.pageY - down_e.pageY) > options.offsetY)) {
								dragged = true;
								$fake = $dragged.clone().css({'position': 'absolute', 'z-index': options.zIndex}).addClass(options.fake_class).appendTo($dragged.offsetParent());
								$dragged.addClass(options.dragged_class);
								options.start({
									'event': move_e,
									'dragged': $dragged,
									'fake': $fake,
									'dragged_pos': dragged_pos,
									'dragged_offset': dragged_offset
								});
							}
							if (dragged) {
								var dx = move_e.pageX - down_e.pageX;
								var dy = move_e.pageY - down_e.pageY;
								$fake[0].style.left = (dx + dragged_pos.left).toString() + 'px';
								$fake[0].style.top = (dy + dragged_pos.top).toString() + 'px';
								options.move({
									'event': move_e,
									'dragged': $dragged,
									'fake': $fake,
									'dx': dx,
									'dy': dy,
									'parent_offset_x': dx + dragged_pos.left,
									'parent_offset_y': dy + dragged_pos.top,
									'offset_x': dx + dragged_offset.left,
									'offset_y': dy + dragged_offset.top
								});
							}
							return false;
						})
						.bind('mouseup.moveable touchend.movable', function(up_e){
							fixTouch(up_e);
							$(document).unbind('mousemove.moveable mouseup.moveable touchmove.movable touchend.movable');
							if (dragged) {
								var dx = up_e.pageX - down_e.pageX;
								var dy = up_e.pageY - down_e.pageY;
								var keep_fake = false;
								dragged = false;
								options.finish({
									'event': up_e,
									'dragged': $dragged,
									'fake': $fake,
									'dx': dx,
									'dy': dy,
									'parent_offset_x': dx + dragged_pos.left,
									'parent_offset_y': dy + dragged_pos.top,
									'offset_x': dx + dragged_offset.left,
									'offset_y': dy + dragged_offset.top,
									'keep_fake':
										function() {
											keep_fake = true;
										}
								});
								if ( ! keep_fake) {
									$fake.remove();
								}
								$dragged.removeClass(options.dragged_class);
							}
						});
					return false;
				})
				.find('*')
				.click(function(){
					if (dragged) {
						return false;
					}
				});
			return this;
		},
		sortable: function(this_options) {
			var movable_options = $.extend({}, this_options);
			var defaults = {
				'nearest_finder': $.nearestFinder(this),
				'dragged_class': 'ui-moved',
				'check_bounds':
					function (info) {
						return true;
					},
				'start': $.noop,
				'attach': $.noop,
				'move': $.noop,
				'finish': $.noop
			};
			var this_options = $.extend({}, defaults, this_options);
			var initial_next = false;


			movable_options.start = function(info) {
				this_options.start(info);
				this_options.nearest_finder.update();
				initial_next = info.dragged.next();
			}
			movable_options.move = function(info) {
				info.nearest = null;

				if (this_options.check_bounds(info)) {
					var $nearest = info.nearest = this_options.nearest_finder.getNearestNotLast(info.offset_x + info.dragged.width() / 2, info.offset_y);

					info.dragged.addClass(this_options.dragged_class);
					if ($nearest && $nearest[0] != info.dragged[0]) {
						if (info.dragged.nextAll().filter($nearest[0]).length > 0) {
							info.dragged.insertAfter($nearest);
						} else {
							info.dragged.insertBefore($nearest);
						}
						this_options.attach(info);
						this_options.nearest_finder.update();
					}
				} else if (this_options.nearest_finder.last_nearest !== null) {
					this_options.nearest_finder.last_nearest = null;
					if (initial_next.length) {
						info.dragged.insertBefore(initial_next);
					} else {
						info.dragged.parent().append(info.dragged);
					}
					info.dragged.removeClass(this_options.dragged_class);
					this_options.attach(info);
					this_options.nearest_finder.update();
				}

				this_options.move(info);
			}
			movable_options.finish = function(info) {
				info.nearest = null;
				if (this_options.check_bounds(info)) {
					info.nearest = this_options.nearest_finder.getNearest(info.offset_x + info.dragged.width() / 2, info.offset_y);
				}
				this_options.finish(info);
			}

			return this.moveable(movable_options);
		}
	});
})(jQuery);
