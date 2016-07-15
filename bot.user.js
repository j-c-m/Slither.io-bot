/*
The MIT License (MIT)
 Copyright (c) 2016 Jesse Miller <jmiller@jmiller.com>
 Copyright (c) 2016 Alexey Korepanov <kaikaikai@yandex.ru>
 Copyright (c) 2016 Ermiya Eskandary & Théophile Cailliau and other contributors
 https://jmiller.mit-license.org/
*/
// ==UserScript==
// @name         Slither.io Bot Championship Edition
// @namespace    https://github.com/j-c-m/Slither.io-bot
// @version      3.0.1
// @description  Slither.io Bot Championship Edition
// @author       Jesse Miller
// @match        http://slither.io/
// @updateURL    https://github.com/j-c-m/Slither.io-bot/raw/master/bot.user.js
// @downloadURL  https://github.com/j-c-m/Slither.io-bot/raw/master/bot.user.js
// @supportURL   https://github.com/j-c-m/Slither.io-bot/issues
// @grant        none
// ==/UserScript==

// Custom logging function - disabled by default
window.log = function () {
    if (window.logDebugging) {
        console.log.apply(console, arguments);
    }
};

var canvas = window.canvas = (function (window) {
    return {
        // Spoofs moving the mouse to the provided coordinates.
        setMouseCoordinates: function (point) {
            window.xm = point.x;
            window.ym = point.y;
        },

        // Convert map coordinates to mouse coordinates.
        mapToMouse: function (point) {
            var mouseX = (point.x - window.snake.xx) * window.gsc;
            var mouseY = (point.y - window.snake.yy) * window.gsc;
            return { x: mouseX, y: mouseY };
        },

        // Map cordinates to Canvas cordinate shortcut
        mapToCanvas: function (point) {
            var c = {
                x: window.mww2 + (point.x - window.view_xx) * window.gsc,
                y: window.mhh2 + (point.y - window.view_yy) * window.gsc
            };
            return c;
        },

        // Map to Canvas coordinate conversion for drawing circles.
        // Radius also needs to scale by .gsc
        circleMapToCanvas: function (circle) {
            var newCircle = canvas.mapToCanvas({
                x: circle.x,
                y: circle.y
            });
            return canvas.circle(
                newCircle.x,
                newCircle.y,
                circle.radius * window.gsc
            );
        },

        // Constructor for point type
        point: function (x, y) {
            var p = {
                x: Math.round(x),
                y: Math.round(y)
            };

            return p;
        },

        // Constructor for rect type
        rect: function (x, y, w, h) {
            var r = {
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(w),
                height: Math.round(h)
            };

            return r;
        },

        // Constructor for circle type
        circle: function (x, y, r) {
            var c = {
                x: Math.round(x),
                y: Math.round(y),
                radius: Math.round(r)
            };

            return c;
        },

        // Fast atan2
        fastAtan2: function (y, x) {
            const QPI = Math.PI / 4;
            const TQPI = 3 * Math.PI / 4;
            var r = 0.0;
            var angle = 0.0;
            var abs_y = Math.abs(y) + 1e-10;
            if (x < 0) {
                r = (x + abs_y) / (abs_y - x);
                angle = TQPI;
            } else {
                r = (x - abs_y) / (x + abs_y);
                angle = QPI;
            }
            angle += (0.1963 * r * r - 0.9817) * r;
            if (y < 0) {
                return -angle;
            }

            return angle;
        },

        // Adjusts zoom in response to the mouse wheel.
        setZoom: function (e) {
            // Scaling ratio
            if (window.gsc) {
                window.gsc *= Math.pow(0.9, e.wheelDelta / -120 || e.detail / 2 || 0);
                window.desired_gsc = window.gsc;
            }
        },

        // Restores zoom to the default value.
        resetZoom: function () {
            window.gsc = 0.9;
            window.desired_gsc = 0.9;
        },

        // Maintains Zoom
        maintainZoom: function () {
            if (window.desired_gsc !== undefined) {
                window.gsc = window.desired_gsc;
            }
        },

        // Sets background to the given image URL.
        // Defaults to slither.io's own background.
        setBackground: function (url) {
            url = typeof url !== 'undefined' ? url : '/s/bg45.jpg';
            window.ii.src = url;
        },

        // Draw a rectangle on the canvas.
        drawRect: function (rect, color, fill, alpha) {
            if (alpha === undefined) alpha = 1;

            var context = window.mc.getContext('2d');
            var lc = canvas.mapToCanvas({ x: rect.x, y: rect.y });

            context.save();
            context.globalAlpha = alpha;
            context.strokeStyle = color;
            context.rect(lc.x, lc.y, rect.width * window.gsc, rect.height * window.gsc);
            context.stroke();
            if (fill) {
                context.fillStyle = color;
                context.fill();
            }
            context.restore();
        },

        // Draw a circle on the canvas.
        drawCircle: function (circle, color, fill, alpha) {
            if (alpha === undefined) alpha = 1;
            if (circle.radius === undefined) circle.radius = 5;

            var context = window.mc.getContext('2d');
            var drawCircle = canvas.circleMapToCanvas(circle);

            context.save();
            context.globalAlpha = alpha;
            context.beginPath();
            context.strokeStyle = color;
            context.arc(drawCircle.x, drawCircle.y, drawCircle.radius, 0, Math.PI * 2);
            context.stroke();
            if (fill) {
                context.fillStyle = color;
                context.fill();
            }
            context.restore();
        },

        // Draw an angle.
        // @param {number} start -- where to start the angle
        // @param {number} angle -- width of the angle
        // @param {bool} danger -- green if false, red if true
        drawAngle: function (start, angle, color, fill, alpha) {
            if (alpha === undefined) alpha = 0.6;

            var context = window.mc.getContext('2d');

            context.save();
            context.globalAlpha = alpha;
            context.beginPath();
            context.moveTo(window.mc.width / 2, window.mc.height / 2);
            context.arc(window.mc.width / 2, window.mc.height / 2, window.gsc * 100, start, angle);
            context.lineTo(window.mc.width / 2, window.mc.height / 2);
            context.closePath();
            context.stroke();
            if (fill) {
                context.fillStyle = color;
                context.fill();
            }
            context.restore();
        },

        // Draw a line on the canvas.
        drawLine: function (p1, p2, color, width) {
            if (width === undefined) width = 5;

            var context = window.mc.getContext('2d');
            var dp1 = canvas.mapToCanvas(p1);
            var dp2 = canvas.mapToCanvas(p2);

            context.save();
            context.beginPath();
            context.lineWidth = width * window.gsc;
            context.strokeStyle = color;
            context.moveTo(dp1.x, dp1.y);
            context.lineTo(dp2.x, dp2.y);
            context.stroke();
            context.restore();
        },

        // Given the start and end of a line, is point left.
        isLeft: function (start, end, point) {
            return ((end.x - start.x) * (point.y - start.y) -
                (end.y - start.y) * (point.x - start.x)) > 0;

        },

        // Get distance squared
        getDistance2: function (x1, y1, x2, y2) {
            var distance2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
            return distance2;
        },

        getDistance2FromSnake: function (point) {
            point.distance = canvas.getDistance2(window.snake.xx, window.snake.yy,
                point.xx, point.yy);
            return point;
        },

        // return unit vector in the direction of the argument
        unitVector: function (v) {
            var l = Math.sqrt(v.x * v.x + v.y * v.y);
            if (l > 0) {
                return {
                    x: v.x / l,
                    y: v.y / l
                };
            } else {
                return {
                    x: 0,
                    y: 0
                };
            }
        },

        // Check if point in Rect
        pointInRect: function (point, rect) {
            if (rect.x <= point.x && rect.y <= point.y &&
                rect.x + rect.width >= point.x && rect.y + rect.height >= point.y) {
                return true;
            }
            return false;
        },

        // check if point is in polygon
        pointInPoly: function (point, poly) {
            if (point.x < poly.minx || point.x > poly.maxx ||
                point.y < poly.miny || point.y > poly.maxy) {
                return false;
            }
            let c = false;
            const l = poly.pts.length;
            for (let i = 0, j = l - 1; i < l; j = i++) {
                if ( ((poly.pts[i].y > point.y) != (poly.pts[j].y > point.y)) &&
                    (point.x < (poly.pts[j].x - poly.pts[i].x) * (point.y - poly.pts[i].y) /
                        (poly.pts[j].y - poly.pts[i].y) + poly.pts[i].x) ) {
                    c = !c;
                }
            }
            return c;
        },

        addPolyBox: function (poly) {
            var minx = poly.pts[0].x;
            var maxx = poly.pts[0].x;
            var miny = poly.pts[0].y;
            var maxy = poly.pts[0].y;
            for (let p = 1, l = poly.pts.length; p < l; p++) {
                if (poly.pts[p].x < minx) {
                    minx = poly.pts[p].x;
                }
                if (poly.pts[p].x > maxx) {
                    maxx = poly.pts[p].x;
                }
                if (poly.pts[p].y < miny) {
                    miny = poly.pts[p].y;
                }
                if (poly.pts[p].y > maxy) {
                    maxy = poly.pts[p].y;
                }
            }
            return {
                pts: poly.pts,
                minx: minx,
                maxx: maxx,
                miny: miny,
                maxy: maxy
            };
        },

        cross: function (o, a, b) {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        },

        convexHullSort: function (a, b) {
            return a.x == b.x ? a.y - b.y : a.x - b.x;
        },

        convexHull: function (points) {
            points.sort(canvas.convexHullSort);

            var lower = [];
            for (let i = 0, l = points.length; i < l; i++) {
                while (lower.length >= 2 && canvas.cross(
                    lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
                    lower.pop();
                }
                lower.push(points[i]);
            }

            var upper = [];
            for (let i = points.length - 1; i >= 0; i--) {
                while (upper.length >= 2 && canvas.cross(
                    upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
                    upper.pop();
                }
                upper.push(points[i]);
            }

            upper.pop();
            lower.pop();
            return lower.concat(upper);
        },

        // Check if circles intersect
        circleIntersect: function (circle1, circle2) {
            var bothRadii = circle1.radius + circle2.radius;
            var point = {};

            // Pretends the circles are squares for a quick collision check.
            // If it collides, do the more expensive circle check.
            if (circle1.x + bothRadii > circle2.x &&
                circle1.y + bothRadii > circle2.y &&
                circle1.x < circle2.x + bothRadii &&
                circle1.y < circle2.y + bothRadii) {

                var distance2 = canvas.getDistance2(circle1.x, circle1.y, circle2.x, circle2.y);

                if (distance2 < bothRadii * bothRadii) {
                    point = {
                        x: ((circle1.x * circle2.radius) + (circle2.x * circle1.radius)) /
                        bothRadii,
                        y: ((circle1.y * circle2.radius) + (circle2.y * circle1.radius)) /
                        bothRadii,
                        ang: 0.0
                    };

                    point.ang = canvas.fastAtan2(
                        point.y - window.snake.yy, point.x - window.snake.xx);

                    if (window.visualDebugging) {
                        var collisionPointCircle = canvas.circle(
                            point.x,
                            point.y,
                            5
                        );
                        canvas.drawCircle(circle2, '#ff9900', false);
                        canvas.drawCircle(collisionPointCircle, '#66ff66', true);
                    }
                    return point;
                }
            }
            return false;
        }
    };
})(window);

var bot = window.bot = (function (window) {
    return {
        isBotRunning: false,
        isBotEnabled: true,
        stage: 'grow',
        collisionPoints: [],
        collisionAngles: [],
        foodAngles: [],
        scores: [],
        foodTimeout: undefined,
        sectorBoxSide: 0,
        defaultAccel: 0,
        sectorBox: {},
        currentFood: {},
        opt: {
            // target fps
            targetFps: 30,
            // size of arc for collisionAngles
            arcSize: Math.PI / 8,
            // radius multiple for circle intersects
            radiusMult: 10,
            // food cluster size to trigger acceleration
            foodAccelSz: 200,
            // maximum angle of food to trigger acceleration
            foodAccelDa: Math.PI / 2,
            // how many frames per action
            actionFrames: 2,
            // how many frames to delay action after collision
            collisionDelay: 15,
            // base speed
            speedBase: 5.78,
            // front angle size
            frontAngle: Math.PI / 2,
            // percent of angles covered by same snake to be considered an encircle attempt
            enCircleThreshold: 0.5625,
            // percent of angles covered by all snakes to move to safety
            enCircleAllThreshold: 0.5625,
            // distance multiplier for enCircleAllThreshold
            enCircleDistanceMult: 20,
            // snake score to start circling on self
            followCircleLength: 5000
        },
        MID_X: 0,
        MID_Y: 0,
        MAP_R: 0,
        MAXARC: 0,

        getSnakeWidth: function (sc) {
            if (sc === undefined) sc = window.snake.sc;
            return Math.round(sc * 29.0);
        },

        quickRespawn: function () {
            window.dead_mtm = 0;
            window.login_fr = 0;

            bot.isBotRunning = false;
            window.forcing = true;
            bot.connect();
            window.forcing = false;
        },

        connect: function () {
            if (window.force_ip && window.force_port) {
                window.forceServer(window.force_ip, window.force_port);
            }

            window.connect();
        },

        // angleBetween - get the smallest angle between two angles (0-pi)
        angleBetween: function (a1, a2) {
            var r1 = 0.0;
            var r2 = 0.0;

            r1 = (a1 - a2) % Math.PI;
            r2 = (a2 - a1) % Math.PI;

            return r1 < r2 ? -r1 : r2;
        },

        // Change heading to ang
        changeHeadingAbs: function (angle) {
            var cos = Math.cos(angle);
            var sin = Math.sin(angle);

            window.goalCoordinates = {
                x: Math.round(
                    window.snake.xx + (bot.headCircle.radius) * cos),
                y: Math.round(
                    window.snake.yy + (bot.headCircle.radius) * sin)
            };

            /*if (window.visualDebugging) {
                canvas.drawLine({
                    x: window.snake.xx,
                    y: window.snake.yy},
                    window.goalCoordinates, 'yellow', '8');
            }*/

            canvas.setMouseCoordinates(canvas.mapToMouse(window.goalCoordinates));
        },

        // Change heading by ang
        // +0-pi turn left
        // -0-pi turn right

        changeHeadingRel: function (angle) {
            var heading = {
                x: window.snake.xx + 500 * bot.cos,
                y: window.snake.yy + 500 * bot.sin
            };

            var cos = Math.cos(-angle);
            var sin = Math.sin(-angle);

            window.goalCoordinates = {
                x: Math.round(
                    cos * (heading.x - window.snake.xx) -
                    sin * (heading.y - window.snake.yy) + window.snake.xx),
                y: Math.round(
                    sin * (heading.x - window.snake.xx) +
                    cos * (heading.y - window.snake.yy) + window.snake.yy)
            };

            canvas.setMouseCoordinates(canvas.mapToMouse(window.goalCoordinates));
        },

        // Change heading to the best angle for avoidance.
        headingBestAngle: function () {
            var best;
            var distance;
            var openAngles = [];
            var openStart;

            var sIndex = bot.getAngleIndex(window.snake.ehang) + bot.MAXARC / 2;
            if (sIndex > bot.MAXARC) sIndex -= bot.MAXARC;

            for (var i = 0; i < bot.MAXARC; i++) {
                if (bot.collisionAngles[i] === undefined) {
                    distance = 0;
                    if (openStart === undefined) openStart = i;
                } else {
                    distance = bot.collisionAngles[i].distance;
                    if (openStart) {
                        openAngles.push({
                            openStart: openStart,
                            openEnd: i - 1,
                            sz: (i - 1) - openStart
                        });
                        openStart = undefined;
                    }
                }

                if (best === undefined ||
                    (best.distance < distance && best.distance !== 0)) {
                    best = {
                        distance: distance,
                        aIndex: i
                    };
                }
            }

            if (openStart && openAngles[0]) {
                openAngles[0].openStart = openStart;
                openAngles[0].sz = openAngles[0].openEnd - openStart;
                if (openAngles[0].sz < 0) openAngles[0].sz += bot.MAXARC;

            } else if (openStart) {
                openAngles.push({openStart: openStart, openEnd: openStart, sz: 0});
            }

            if (openAngles.length > 0) {
                openAngles.sort(bot.sortSz);
                bot.changeHeadingAbs(
                    (openAngles[0].openEnd - openAngles[0].sz / 2) * bot.opt.arcSize);
            } else {
                bot.changeHeadingAbs(best.aIndex * bot.opt.arcSize);
            }
        },

        // Avoid collision point by ang
        // ang radians <= Math.PI (180deg)
        avoidCollisionPoint: function (point, ang) {
            if (ang === undefined || ang > Math.PI) {
                ang = Math.PI;
            }

            var end = {
                x: window.snake.xx + 2000 * bot.cos,
                y: window.snake.yy + 2000 * bot.sin
            };

            if (window.visualDebugging) {
                canvas.drawLine(
                    { x: window.snake.xx, y: window.snake.yy },
                    end,
                    'orange', 5);
                canvas.drawLine(
                    { x: window.snake.xx, y: window.snake.yy },
                    { x: point.x, y: point.y },
                    'red', 5);
            }

            if (canvas.isLeft(
                { x: window.snake.xx, y: window.snake.yy }, end,
                { x: point.x, y: point.y })) {
                bot.changeHeadingAbs(point.ang - ang);
            } else {
                bot.changeHeadingAbs(point.ang + ang);
            }
        },

        // get collision angle index, expects angle +/i 0 to Math.PI
        getAngleIndex: function (angle) {
            var index;

            if (angle < 0) {
                angle += 2 * Math.PI;
            }

            index = Math.round(angle * (1 / bot.opt.arcSize));

            if (index === bot.MAXARC) {
                return 0;
            }
            return index;
        },

        // Add to collisionAngles if distance is closer
        addCollisionAngle: function (sp) {
            var ang = canvas.fastAtan2(
                Math.round(sp.yy - window.snake.yy),
                Math.round(sp.xx - window.snake.xx));
            var aIndex = bot.getAngleIndex(ang);

            var actualDistance = Math.round(Math.pow(
                Math.sqrt(sp.distance) - sp.radius, 2));

            if (bot.collisionAngles[aIndex] === undefined ||
                 bot.collisionAngles[aIndex].distance > sp.distance) {
                bot.collisionAngles[aIndex] = {
                    x: Math.round(sp.xx),
                    y: Math.round(sp.yy),
                    ang: ang,
                    snake: sp.snake,
                    distance: actualDistance,
                    radius: sp.radius,
                    aIndex: aIndex
                };
            }
        },

        // Add and score foodAngles
        addFoodAngle: function (f) {
            var ang = canvas.fastAtan2(
                Math.round(f.yy - window.snake.yy),
                Math.round(f.xx - window.snake.xx));

            var aIndex = bot.getAngleIndex(ang);

            canvas.getDistance2FromSnake(f);

            if (bot.collisionAngles[aIndex] === undefined ||
                Math.sqrt(bot.collisionAngles[aIndex].distance) >
                Math.sqrt(f.distance) + bot.snakeRadius * bot.opt.radiusMult * bot.speedMult / 2) {
                if (bot.foodAngles[aIndex] === undefined) {
                    bot.foodAngles[aIndex] = {
                        x: Math.round(f.xx),
                        y: Math.round(f.yy),
                        ang: ang,
                        da: Math.abs(bot.angleBetween(ang, window.snake.ehang)),
                        distance: f.distance,
                        sz: f.sz,
                        score: Math.pow(f.sz, 2) / f.distance
                    };
                } else {
                    bot.foodAngles[aIndex].sz += Math.round(f.sz);
                    bot.foodAngles[aIndex].score += Math.pow(f.sz, 2) / f.distance;
                    if (bot.foodAngles[aIndex].distance > f.distance) {
                        bot.foodAngles[aIndex].x = Math.round(f.xx);
                        bot.foodAngles[aIndex].y = Math.round(f.yy);
                        bot.foodAngles[aIndex].distance = f.distance;
                    }
                }
            }
        },

        // Get closest collision point per snake.
        getCollisionPoints: function () {
            var scPoint;

            bot.collisionPoints = [];
            bot.collisionAngles = [];


            for (var snake = 0, ls = window.snakes.length; snake < ls; snake++) {
                scPoint = undefined;

                if (window.snakes[snake].id !== window.snake.id &&
                    window.snakes[snake].alive_amt === 1) {

                    var s = window.snakes[snake];
                    var sRadius = bot.getSnakeWidth(s.sc) / 2;
                    var sSpMult = Math.min(1, s.sp / 5.78 - 1 );

                    scPoint = {
                        xx: s.xx + Math.cos(s.ehang) * sRadius * sSpMult * bot.opt.radiusMult / 2,
                        yy: s.yy + Math.sin(s.ehang) * sRadius * sSpMult * bot.opt.radiusMult / 2,
                        snake: snake,
                        radius: bot.headCircle.radius,
                        head: true
                    };

                    canvas.getDistance2FromSnake(scPoint);
                    bot.addCollisionAngle(scPoint);
                    bot.collisionPoints.push(scPoint);

                    if (window.visualDebugging) {
                        canvas.drawCircle(canvas.circle(
                            scPoint.xx,
                            scPoint.yy,
                            scPoint.radius),
                            'red', false);
                    }

                    scPoint = undefined;

                    for (var pts = 0, lp = s.pts.length; pts < lp; pts++) {
                        if (!s.pts[pts].dying &&
                            canvas.pointInRect(
                                {
                                    x: s.pts[pts].xx,
                                    y: s.pts[pts].yy
                                }, bot.sectorBox)
                        ) {
                            var collisionPoint = {
                                xx: s.pts[pts].xx,
                                yy: s.pts[pts].yy,
                                snake: snake,
                                radius: sRadius
                            };

                            if (window.visualDebugging && true === false) {
                                canvas.drawCircle(canvas.circle(
                                    collisionPoint.xx,
                                    collisionPoint.yy,
                                    collisionPoint.radius),
                                    '#00FF00', false);
                            }

                            canvas.getDistance2FromSnake(collisionPoint);
                            bot.addCollisionAngle(collisionPoint);

                            if (collisionPoint.distance <= Math.pow(
                                (bot.headCircle.radius)
                                + collisionPoint.radius, 2)) {
                                bot.collisionPoints.push(collisionPoint);
                                if (window.visualDebugging) {
                                    canvas.drawCircle(canvas.circle(
                                        collisionPoint.xx,
                                        collisionPoint.yy,
                                        collisionPoint.radius
                                    ), 'red', false);
                                }
                            }
                        }
                    }
                }
            }

            // WALL
            if (canvas.getDistance2(bot.MID_X, bot.MID_Y, window.snake.xx, window.snake.yy) >
                Math.pow(bot.MAP_R - 1000, 2)) {
                var midAng = canvas.fastAtan2(
                    window.snake.yy - bot.MID_X, window.snake.xx - bot.MID_Y);
                scPoint = {
                    xx: bot.MID_X + bot.MAP_R * Math.cos(midAng),
                    yy: bot.MID_Y + bot.MAP_R * Math.sin(midAng),
                    snake: -1,
                    radius: bot.snakeWidth
                };
                canvas.getDistance2FromSnake(scPoint);
                bot.collisionPoints.push(scPoint);
                bot.addCollisionAngle(scPoint);
                if (window.visualDebugging) {
                    canvas.drawCircle(canvas.circle(
                        scPoint.xx,
                        scPoint.yy,
                        scPoint.radius
                    ), 'yellow', false);
                }
            }


            bot.collisionPoints.sort(bot.sortDistance);
            if (window.visualDebugging) {
                for (var i = 0; i < bot.collisionAngles.length; i++) {
                    if (bot.collisionAngles[i] !== undefined) {
                        canvas.drawLine(
                            { x: window.snake.xx, y: window.snake.yy },
                            { x: bot.collisionAngles[i].x, y: bot.collisionAngles[i].y },
                            'red', 2);
                    }
                }
            }
        },

        // Is collisionPoint (xx) in frontAngle
        inFrontAngle: function (point) {
            var ang = canvas.fastAtan2(
                Math.round(point.y - window.snake.yy),
                Math.round(point.x - window.snake.xx));

            if (Math.abs(bot.angleBetween(ang, window.snake.ehang)) < bot.opt.frontAngle) {
                return true;
            } else {
                return false;
            }

        },

        // Checks to see if you are going to collide with anything in the collision detection radius
        checkCollision: function () {
            var point;

            bot.getCollisionPoints();
            if (bot.collisionPoints.length === 0) return false;

            for (var i = 0; i < bot.collisionPoints.length; i++) {
                var collisionCircle = canvas.circle(
                    bot.collisionPoints[i].xx,
                    bot.collisionPoints[i].yy,
                    bot.collisionPoints[i].radius
                );

                // -1 snake is special case for non snake object.
                if ((point = canvas.circleIntersect(bot.headCircle, collisionCircle)) &&
                    bot.inFrontAngle(point)) {
                    if (bot.collisionPoints[i].snake !== -1 &&
                        bot.collisionPoints[i].head &&
                        window.snakes[bot.collisionPoints[i].snake].sp > 10) {
                        window.setAcceleration(1);
                    } else {
                        window.setAcceleration(bot.defaultAccel);
                    }
                    bot.avoidCollisionPoint(point);
                    return true;
                }
            }

            window.setAcceleration(bot.defaultAccel);
            return false;
        },

        checkEncircle: function () {
            var enSnake = [];
            var high = 0;
            var highSnake;
            var enAll = 0;

            for (var i = 0; i < bot.collisionAngles.length; i++) {
                if (bot.collisionAngles[i] !== undefined) {
                    var s = bot.collisionAngles[i].snake;
                    if (enSnake[s]) {
                        enSnake[s]++;
                    } else {
                        enSnake[s] = 1;
                    }
                    if (enSnake[s] > high) {
                        high = enSnake[s];
                        highSnake = s;
                    }

                    if (bot.collisionAngles[i].distance <
                        Math.pow(bot.snakeRadius * bot.opt.enCircleDistanceMult, 2)) {
                        enAll++;
                    }
                }
            }

            if (high > bot.MAXARC * bot.opt.enCircleThreshold) {
                bot.headingBestAngle();

                if (high !== bot.MAXARC && window.snakes[highSnake].sp > 10) {
                    window.setAcceleration(1);
                } else {
                    window.setAcceleration(bot.defaultAccel);
                }

                if (window.visualDebugging) {
                    canvas.drawCircle(canvas.circle(
                        window.snake.xx,
                        window.snake.yy,
                        bot.opt.radiusMult * bot.snakeRadius),
                        'red', true, 0.2);
                }
                return true;
            }

            if (enAll > bot.MAXARC * bot.opt.enCircleAllThreshold) {
                bot.headingBestAngle();
                window.setAcceleration(bot.defaultAccel);

                if (window.visualDebugging) {
                    canvas.drawCircle(canvas.circle(
                        window.snake.xx,
                        window.snake.yy,
                        bot.snakeRadius * bot.opt.enCircleDistanceMult),
                        'yellow', true, 0.2);
                }
                return true;
            } else {
                if (window.visualDebugging) {
                    canvas.drawCircle(canvas.circle(
                        window.snake.xx,
                        window.snake.yy,
                        bot.snakeRadius * bot.opt.enCircleDistanceMult),
                        'yellow');
                }
            }

            window.setAcceleration(bot.defaultAccel);
            return false;
        },

        bodyDangerZone: function (
            offset, targetPoint, targetPointNormal, closePointDist, pastTargetPoint, closePoint) {
            var head = {
                x: window.snake.xx,
                y: window.snake.yy
            };
            var pts = [
                {
                    x: head.x - offset * bot.sin,
                    y: head.y + offset * bot.cos
                },
                {
                    x: head.x + bot.snakeWidth * bot.cos + offset * (bot.cos - bot.sin),
                    y: head.y + bot.snakeWidth * bot.sin + offset * (bot.sin + bot.cos)
                },
                {
                    x: head.x + 1.75 * bot.snakeWidth * bot.cos + 0.3 * bot.snakeWidth * bot.sin +
                        offset * (bot.cos - bot.sin),
                    y: head.y + 1.75 * bot.snakeWidth * bot.sin - 0.3 * bot.snakeWidth * bot.cos +
                        offset * (bot.sin + bot.cos)
                },
                {
                    x: head.x + 2.5 * bot.snakeWidth * bot.cos + 0.7 * bot.snakeWidth * bot.sin +
                        offset * (bot.cos - bot.sin),
                    y: head.y + 2.5 * bot.snakeWidth * bot.sin - 0.7 * bot.snakeWidth * bot.cos +
                        offset * (bot.sin + bot.cos)
                },
                {
                    x: head.x + 3 * bot.snakeWidth * bot.cos + 1.2 * bot.snakeWidth * bot.sin +
                        offset * bot.cos,
                    y: head.y + 3 * bot.snakeWidth * bot.sin - 1.2 * bot.snakeWidth * bot.cos +
                        offset * bot.sin
                },
                {
                    x: bot.pts[targetPoint].x +
                        targetPointNormal.x * (offset + 0.5 * Math.max(closePointDist, 0)),
                    y: bot.pts[targetPoint].y +
                        targetPointNormal.y * (offset + 0.5 * Math.max(closePointDist, 0))
                },
                {
                    x: bot.pts[pastTargetPoint].x + targetPointNormal.x * offset,
                    y: bot.pts[pastTargetPoint].y + targetPointNormal.y * offset
                },
                bot.pts[pastTargetPoint],
                bot.pts[targetPoint],
                bot.pts[closePoint]
            ];
            pts = canvas.convexHull(pts);
            var poly = {
                pts: pts
            };
            poly = canvas.addPolyBox(poly);
            return (poly);
        },

        followCircleSelf: function () {
            // real points on snake, first head, last tail
            bot.pts = [];
            for (let pts = window.snake.pts.length - 1; pts >= 0 ; pts--) {
                if (!window.snake.pts[pts].dying) {
                    bot.pts.push({
                        x: window.snake.pts[pts].xx,
                        y: window.snake.pts[pts].yy,
                        len: 0.0
                    });
                }
            }
            // add distance along the snake measured from the head
            bot.len = 0.0;
            for (let p = 1; p < bot.pts.length; p++) {
                bot.len += Math.sqrt(canvas.getDistance2(
                    bot.pts[p - 1].x, bot.pts[p - 1].y, bot.pts[p].x, bot.pts[p].y));
                bot.pts[p].len = bot.len;
            }

            var head = {
                x: window.snake.xx,
                y: window.snake.yy };

            // look for a point on own tail closest to window.snake.xx, window.snake.xx
            // tail is everything farther than 8 widths from the head
            var closePoint = -1;
            var closePointDist = -1;
            for (let p = bot.pts.length - 2; p >= 0 && bot.pts[p].len > 8 * bot.snakeWidth; p--) {
                let pen = canvas.getDistance2(
                    head.x, head.y, bot.pts[p].x, bot.pts[p].y);
                if (closePointDist < 0 || pen < closePointDist) {
                    closePointDist = pen;
                    closePoint = p;
                }
            }

            if (closePoint < 0) {
                return;
            }

            // a point just a bit further
            var closePointNext = closePoint;
            while (closePointNext > 0
                && bot.pts[closePoint].len - bot.pts[closePointNext].len < bot.snakeWidth) {
                closePointNext--;
            }

            // compute distance from the body at closePointDist
            var closePointTangent = canvas.unitVector({
                x: bot.pts[closePointNext].x - bot.pts[closePoint].x,
                y: bot.pts[closePointNext].y - bot.pts[closePoint].y});
            var closePointNormal = {
                x: -closePointTangent.y,
                y:  closePointTangent.x
            };
            closePointDist =
                closePointNormal.x * (head.x - bot.pts[closePoint].x) +
                closePointNormal.y * (head.y - bot.pts[closePoint].y);

            // construct polygon for snake inside
            var bot_pts_length = bot.pts.length;
            var insidePolygonStart = 0;
            while (bot.pts[insidePolygonStart].len < 5 * bot.snakeWidth
                && insidePolygonStart < bot_pts_length - 1) {
                insidePolygonStart ++;
            }
            var insidePolygonEnd = 0;
            while (bot.pts[insidePolygonEnd].len - bot.pts[closePoint].len < 5 * bot.snakeWidth
                && insidePolygonEnd < bot_pts_length - 1) {
                insidePolygonEnd ++;
            }
            var insidePolygon = canvas.addPolyBox({
                pts: bot.pts.slice(insidePolygonStart, 1 + insidePolygonEnd)
            });

            // get target point; this is an estimate where we land if we hurry
            var targetPointFar = 0.5 * bot.snakeWidth + Math.max(0, closePointDist) +
                1.25 * bot.snakeWidth *
                Math.max(0, bot.cos * closePointNormal.x + bot.sin * closePointNormal.y);
            var targetPoint = closePoint;
            while (targetPoint > 0
                && bot.pts[closePoint].len - bot.pts[targetPoint].len < 0.5 * targetPointFar) {
                targetPoint--;
            }

            if (targetPoint == 0 || targetPoint == bot.pts.length - 1) {
                return;
            }
            // normal vector at the target point
            var targetPointNormal = canvas.unitVector({
                x: -bot.pts[targetPoint - 1].y + bot.pts[targetPoint + 1].y,
                y: bot.pts[targetPoint - 1].x - bot.pts[targetPoint + 1].x
            });

            var pastTargetPoint = targetPoint;
            while (pastTargetPoint > 0
                && bot.pts[targetPoint].len - bot.pts[pastTargetPoint].len < 3 * bot.snakeWidth) {
                pastTargetPoint--;
            }

            // look for danger from enemies
            var enemyBodyOffsetDelta = 0.25 * bot.snakeWidth;
            var safeZone = {
                x: bot.pts[targetPoint].x,
                y: bot.pts[targetPoint].y,
                r: 3 * targetPointFar,
                r2: 0.0
            };
            safeZone.r2 = safeZone.r * safeZone.r;
            var enemyHeadDist2 = 64 * 64 * bot.snakeWidth * bot.snakeWidth;
            for (let snake = 0, snakesNum = window.snakes.length; snake < snakesNum; snake++) {
                if (window.snakes[snake].id !== window.snake.id
                    && window.snakes[snake].alive_amt === 1) {
                    let enemyHead = {
                        x: window.snakes[snake].xx,
                        y: window.snakes[snake].yy
                    };
                    let enemyAhead = {
                        x: window.snakes[snake].xx +
                            Math.cos(window.snakes[snake].ang) * bot.snakeWidth,
                        y: window.snakes[snake].yy +
                            Math.sin(window.snakes[snake].ang) * bot.snakeWidth
                    };
                    // heads
                    if (!canvas.pointInPoly(enemyHead, insidePolygon)) {
                        enemyHeadDist2 = Math.min(
                            enemyHeadDist2,
                            canvas.getDistance2(enemyHead.x,  enemyHead.y, safeZone.x, safeZone.y),
                            canvas.getDistance2(enemyAhead.x, enemyAhead.y, safeZone.x, safeZone.y)
                            );
                    }
                    // bodies
                    let offsetSet = false;
                    let offset = 0.0;
                    let cpolbody = {};
                    for (let pts = 0, ptsNum = window.snakes[snake].pts.length;
                        pts < ptsNum; pts++) {
                        if (!window.snakes[snake].pts[pts].dying) {
                            let point = {
                                x: window.snakes[snake].pts[pts].xx,
                                y: window.snakes[snake].pts[pts].yy
                            };
                            while (!offsetSet || (enemyBodyOffsetDelta >= -bot.snakeWidth
                                && canvas.pointInPoly(point, cpolbody))) {
                                if (!offsetSet) {
                                    offsetSet = true;
                                } else {
                                    enemyBodyOffsetDelta -= 0.0625 * bot.snakeWidth;
                                }
                                offset = 0.5 * (bot.snakeWidth +
                                    bot.getSnakeWidth(window.snakes[snake].sc)) +
                                    enemyBodyOffsetDelta;
                                cpolbody = bot.bodyDangerZone(
                                    offset, targetPoint, targetPointNormal, closePointDist,
                                    pastTargetPoint, closePoint);

                            }
                        }
                    }
                }
            }
            var enemyHeadDist = Math.sqrt(enemyHeadDist2);

            // plot inside polygon
            if (window.visualDebugging) {
                for (let p = 0, l = insidePolygon.pts.length; p < l; p++) {
                    let q = p + 1;
                    if (q == l) {
                        q = 0;
                    }
                    canvas.drawLine(
                        {x: insidePolygon.pts[p].x, y: insidePolygon.pts[p].y},
                        {x: insidePolygon.pts[q].x, y: insidePolygon.pts[q].y},
                        'orange');
                }
            }

            // mark closePoint
            if (window.visualDebugging) {
                canvas.drawCircle(canvas.circle(
                    bot.pts[closePoint].x,
                    bot.pts[closePoint].y,
                    bot.snakeWidth * 0.25
                ), 'white', false);
            }

            // mark safeZone
            if (window.visualDebugging) {
                canvas.drawCircle(canvas.circle(
                    safeZone.x,
                    safeZone.y,
                    safeZone.r
                ), 'white', false);
                canvas.drawCircle(canvas.circle(
                    safeZone.x,
                    safeZone.y,
                    0.2 * bot.snakeWidth
                ), 'white', false);
            }

            // draw sample cpolbody
            if (window.visualDebugging) {
                let soffset = 0.5 * bot.snakeWidth;
                let scpolbody = bot.bodyDangerZone(
                    soffset, targetPoint, targetPointNormal,
                    closePointDist, pastTargetPoint, closePoint);
                for (let p = 0, l = scpolbody.pts.length; p < l; p++) {
                    let q = p + 1;
                    if (q == l) {
                        q = 0;
                    }
                    canvas.drawLine(
                        {x: scpolbody.pts[p].x, y: scpolbody.pts[p].y},
                        {x: scpolbody.pts[q].x, y: scpolbody.pts[q].y},
                        'white');
                }
            }

            // angle wrt closePointTangent
            var currentCourse = Math.asin(Math.max(
                -1, Math.min(1, bot.cos * closePointNormal.x + bot.sin * closePointNormal.y)));

            // TAKE ACTION

            // expand?
            let targetCourse = currentCourse + 0.25;
            // enemy head nearby?
            let headProx = -(safeZone.r - enemyHeadDist) / bot.snakeWidth;
            if (headProx > 0) {
                headProx = 0.125 * headProx * headProx;
            } else {
                headProx = - 0.5 * headProx * headProx;
            }
            targetCourse = Math.min(targetCourse, headProx);
            // enemy body nearby?
            targetCourse = Math.min(
                targetCourse, targetCourse + (enemyBodyOffsetDelta - 0.0625 * bot.snakeWidth) /
                bot.snakeWidth);
            // small tail?
            var tailBehind = bot.len - bot.pts[closePoint].len;
            var targetDir = canvas.unitVector({
                x: bot.opt.followCircleTarget.x - head.x,
                y: bot.opt.followCircleTarget.y - head.y
            });
            var driftQ = targetDir.x * closePointNormal.x + targetDir.y * closePointNormal.y;
            var allowTail = bot.snakeWidth * (2 - 0.5 * driftQ);
            if (window.visualDebugging) {
                canvas.drawLine(
                    { x: head.x, y: head.y },
                    { x: head.x + allowTail * targetDir.x, y: head.y + allowTail * targetDir.y },
                    'red');
            }
            targetCourse = Math.min(
                targetCourse,
                (tailBehind - allowTail + 0.5 * (bot.snakeWidth - closePointDist)) /
                bot.snakeWidth);
            // far away?
            targetCourse = Math.min(
                targetCourse, - 0.5 * (closePointDist - 4 * bot.snakeWidth) / bot.snakeWidth);
            // final corrections
            // too fast in?
            targetCourse = Math.max(targetCourse, -0.75 * closePointDist / bot.snakeWidth);
            // too fast out?
            targetCourse = Math.min(targetCourse, 1.0);

            var goalDir = {
                x: closePointTangent.x * Math.cos(targetCourse) - closePointTangent.y *
                    Math.sin(targetCourse),
                y: closePointTangent.y * Math.cos(targetCourse) + closePointTangent.x *
                    Math.sin(targetCourse)
            };
            var goal = {
                x: head.x + goalDir.x * 4 * bot.snakeWidth,
                y: head.y + goalDir.y * 4 * bot.snakeWidth
            };


            if (window.goalCoordinates
                && Math.abs(goal.x - window.goalCoordinates.x) < 1000
                && Math.abs(goal.y - window.goalCoordinates.y) < 1000) {
                window.goalCoordinates = {
                    x: Math.round(goal.x * 0.25 + window.goalCoordinates.x * 0.75),
                    y: Math.round(goal.y * 0.25 + window.goalCoordinates.y * 0.75)
                };
            } else {
                window.goalCoordinates = {
                    x: Math.round(goal.x),
                    y: Math.round(goal.y)
                };
            }

            canvas.setMouseCoordinates(canvas.mapToMouse(window.goalCoordinates));
        },

        // Sorting by property 'score' descending
        sortScore: function (a, b) {
            return b.score - a.score;
        },

        // Sorting by property 'sz' descending
        sortSz: function (a, b) {
            return b.sz - a.sz;
        },

        // Sorting by property 'distance' ascending
        sortDistance: function (a, b) {
            return a.distance - b.distance;
        },

        computeFoodGoal: function () {
            bot.foodAngles = [];

            for (var i = 0; i < window.foods.length && window.foods[i] !== null; i++) {
                var f = window.foods[i];

                if (!f.eaten &&
                    !(
                        canvas.circleIntersect(
                            canvas.circle(f.xx, f.yy, 2),
                            bot.sidecircle_l) ||
                        canvas.circleIntersect(
                            canvas.circle(f.xx, f.yy, 2),
                            bot.sidecircle_r))) {
                    bot.addFoodAngle(f);
                }
            }

            bot.foodAngles.sort(bot.sortScore);

            if (bot.foodAngles[0] !== undefined && bot.foodAngles[0].sz > 0) {
                bot.currentFood = { x: bot.foodAngles[0].x,
                                    y: bot.foodAngles[0].y,
                                    sz: bot.foodAngles[0].sz,
                                    da: bot.foodAngles[0].da };
            } else {
                bot.currentFood = { x: bot.MID_X, y: bot.MID_Y, sz: 0 };
            }
        },

        foodAccel: function () {
            var aIndex = 0;

            if (bot.currentFood && bot.currentFood.sz > bot.opt.foodAccelSz) {
                aIndex = bot.getAngleIndex(bot.currentFood.ang);

                if (
                    bot.collisionAngles[aIndex] && bot.collisionAngles[aIndex].distance >
                    bot.currentFood.distance + bot.snakeRadius * bot.opt.radiusMult
                    && bot.currentFood.da < bot.opt.foodAccelDa) {
                    return 1;
                }

                if (bot.collisionAngles[aIndex] === undefined
                    && bot.currentFood.da < bot.opt.foodAccelDa) {
                    return 1;
                }
            }

            return bot.defaultAccel;
        },

        toCircle: function () {
            for (var i = 0; i < window.snake.pts.length && window.snake.pts[i].dying; i++);
            var tailCircle = canvas.circle(
                window.snake.pts[i].xx,
                window.snake.pts[i].yy,
                bot.headCircle.radius
            );

            if (window.visualDebugging) {
                canvas.drawCircle(tailCircle, 'blue', false);
            }

            window.setAcceleration(bot.defaultAccel);
            bot.changeHeadingRel(Math.PI / 32);

            if (canvas.circleIntersect(bot.headCircle, tailCircle)) {
                bot.stage = 'circle';
            }
        },

        every: function () {
            bot.MID_X = window.grd;
            bot.MID_Y = window.grd;
            bot.MAP_R = window.grd * 0.98;
            bot.MAXARC = (2 * Math.PI) / bot.opt.arcSize;

            if (bot.opt.followCircleTarget === undefined) {
                bot.opt.followCircleTarget = {
                    x: bot.MID_X,
                    y: bot.MID_Y
                };
            }

            bot.sectorBoxSide = Math.floor(Math.sqrt(window.sectors.length)) * window.sector_size;
            bot.sectorBox = canvas.rect(
                window.snake.xx - (bot.sectorBoxSide / 2),
                window.snake.yy - (bot.sectorBoxSide / 2),
                bot.sectorBoxSide, bot.sectorBoxSide);
            // if (window.visualDebugging) canvas.drawRect(bot.sectorBox, '#c0c0c0', true, 0.1);

            bot.cos = Math.cos(window.snake.ang);
            bot.sin = Math.sin(window.snake.ang);

            bot.speedMult = window.snake.sp / bot.opt.speedBase;
            bot.snakeRadius = bot.getSnakeWidth() / 2;
            bot.snakeWidth = bot.getSnakeWidth();
            bot.snakeLength = Math.floor(15 * (window.fpsls[window.snake.sct] + window.snake.fam /
                window.fmlts[window.snake.sct] - 1) - 5);

            bot.headCircle = canvas.circle(
                window.snake.xx + bot.cos * Math.min(1, bot.speedMult - 1) *
                bot.opt.radiusMult / 2 * bot.snakeRadius,
                window.snake.yy + bot.sin * Math.min(1, bot.speedMult - 1) *
                bot.opt.radiusMult / 2 * bot.snakeRadius,
                bot.opt.radiusMult / 2 * bot.snakeRadius
            );


            if (window.visualDebugging) {
                canvas.drawCircle(bot.headCircle, 'blue', false);
            }

            bot.sidecircle_r = canvas.circle(
                window.snake.lnp.xx -
                ((window.snake.lnp.yy + bot.sin * bot.snakeWidth) -
                    window.snake.lnp.yy),
                window.snake.lnp.yy +
                ((window.snake.lnp.xx + bot.cos * bot.snakeWidth) -
                    window.snake.lnp.xx),
                bot.snakeWidth * bot.speedMult
            );

            bot.sidecircle_l = canvas.circle(
                window.snake.lnp.xx +
                ((window.snake.lnp.yy + bot.sin * bot.snakeWidth) -
                    window.snake.lnp.yy),
                window.snake.lnp.yy -
                ((window.snake.lnp.xx + bot.cos * bot.snakeWidth) -
                    window.snake.lnp.xx),
                bot.snakeWidth * bot.speedMult
            );
        },

        // Main bot
        go: function () {
            bot.every();

            if (bot.snakeLength < bot.opt.followCircleLength) {
                bot.stage = 'grow';
            }

            if (bot.currentFood && bot.stage !== 'grow') {
                bot.currentFood = undefined;
            }

            if (bot.stage === 'circle') {
                window.setAcceleration(bot.defaultAccel);
                bot.followCircleSelf();
            } else if (bot.checkCollision() || bot.checkEncircle()) {
                if (bot.actionTimeout) {
                    window.clearTimeout(bot.actionTimeout);
                    bot.actionTimeout = window.setTimeout(
                        bot.actionTimer, 1000 / bot.opt.targetFps * bot.opt.collisionDelay);
                }
            } else {
                if (bot.snakeLength > bot.opt.followCircleLength) {
                    bot.stage = 'tocircle';
                }
                if (bot.actionTimeout === undefined) {
                    bot.actionTimeout = window.setTimeout(
                        bot.actionTimer, 1000 / bot.opt.targetFps * bot.opt.actionFrames);
                }
                window.setAcceleration(bot.foodAccel());
            }
        },

        // Timer version of food check
        actionTimer: function () {
            if (window.playing && window.snake !== null && window.snake.alive_amt === 1) {
                if (bot.stage === 'grow') {
                    bot.computeFoodGoal();
                    window.goalCoordinates = bot.currentFood;
                    canvas.setMouseCoordinates(canvas.mapToMouse(window.goalCoordinates));
                } else if (bot.stage === 'tocircle') {
                    bot.toCircle();
                }
            }
            bot.actionTimeout = undefined;
        }
    };
})(window);

var userInterface = window.userInterface = (function (window, document) {
    // Save the original slither.io functions so we can modify them, or reenable them later.
    var original_keydown = document.onkeydown;
    var original_onmouseDown = window.onmousedown;
    var original_oef = window.oef;
    var original_redraw = window.redraw;
    var original_onmousemove = window.onmousemove;

    window.oef = function () { };
    window.redraw = function () { };

    return {
        overlays: {},
        gfxEnabled: true,

        initServerIp: function () {
            var parent = document.getElementById('playh');
            var serverDiv = document.createElement('div');
            var serverIn = document.createElement('input');

            serverDiv.style.width = '244px';
            serverDiv.style.margin = '-30px auto';
            serverDiv.style.boxShadow = 'rgb(0, 0, 0) 0px 6px 50px';
            serverDiv.style.opacity = 1;
            serverDiv.style.background = 'rgb(76, 68, 124)';
            serverDiv.className = 'taho';
            serverDiv.style.display = 'block';

            serverIn.className = 'sumsginp';
            serverIn.placeholder = '0.0.0.0:444';
            serverIn.maxLength = 21;
            serverIn.style.width = '220px';
            serverIn.style.height = '24px';

            serverDiv.appendChild(serverIn);
            parent.appendChild(serverDiv);

            userInterface.server = serverIn;
        },

        initOverlays: function () {
            var botOverlay = document.createElement('div');
            botOverlay.style.position = 'fixed';
            botOverlay.style.right = '5px';
            botOverlay.style.bottom = '112px';
            botOverlay.style.width = '150px';
            botOverlay.style.height = '85px';
            // botOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            botOverlay.style.color = '#C0C0C0';
            botOverlay.style.fontFamily = 'Consolas, Verdana';
            botOverlay.style.zIndex = 999;
            botOverlay.style.fontSize = '14px';
            botOverlay.style.padding = '5px';
            botOverlay.style.borderRadius = '5px';
            botOverlay.className = 'nsi';
            document.body.appendChild(botOverlay);

            var serverOverlay = document.createElement('div');
            serverOverlay.style.position = 'fixed';
            serverOverlay.style.right = '5px';
            serverOverlay.style.bottom = '5px';
            serverOverlay.style.width = '160px';
            serverOverlay.style.height = '14px';
            serverOverlay.style.color = '#C0C0C0';
            serverOverlay.style.fontFamily = 'Consolas, Verdana';
            serverOverlay.style.zIndex = 999;
            serverOverlay.style.fontSize = '14px';
            serverOverlay.className = 'nsi';
            document.body.appendChild(serverOverlay);

            var prefOverlay = document.createElement('div');
            prefOverlay.style.position = 'fixed';
            prefOverlay.style.left = '10px';
            prefOverlay.style.top = '75px';
            prefOverlay.style.width = '260px';
            prefOverlay.style.height = '210px';
            // prefOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            prefOverlay.style.color = '#C0C0C0';
            prefOverlay.style.fontFamily = 'Consolas, Verdana';
            prefOverlay.style.zIndex = 999;
            prefOverlay.style.fontSize = '14px';
            prefOverlay.style.padding = '5px';
            prefOverlay.style.borderRadius = '5px';
            prefOverlay.className = 'nsi';
            document.body.appendChild(prefOverlay);

            var statsOverlay = document.createElement('div');
            statsOverlay.style.position = 'fixed';
            statsOverlay.style.left = '10px';
            statsOverlay.style.top = '295px';
            statsOverlay.style.width = '140px';
            statsOverlay.style.height = '210px';
            // statsOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            statsOverlay.style.color = '#C0C0C0';
            statsOverlay.style.fontFamily = 'Consolas, Verdana';
            statsOverlay.style.zIndex = 998;
            statsOverlay.style.fontSize = '14px';
            statsOverlay.style.padding = '5px';
            statsOverlay.style.borderRadius = '5px';
            statsOverlay.className = 'nsi';
            document.body.appendChild(statsOverlay);

            userInterface.overlays.botOverlay = botOverlay;
            userInterface.overlays.serverOverlay = serverOverlay;
            userInterface.overlays.prefOverlay = prefOverlay;
            userInterface.overlays.statsOverlay = statsOverlay;
        },

        toggleOverlays: function () {
            Object.keys(userInterface.overlays).forEach(function (okey) {
                var oVis = userInterface.overlays[okey].style.visibility !== 'hidden' ?
                    'hidden' : 'visible';
                userInterface.overlays[okey].style.visibility = oVis;
                window.visualDebugging = oVis === 'visible';
            });
        },


        toggleGfx: function () {
            if (userInterface.gfxEnabled) {
                var c = window.mc.getContext('2d');
                c.save();
                c.fillStyle = "#000000",
                c.fillRect(0, 0, window.mww, window.mhh),
                c.restore();

                var d = document.createElement('div');
                d.style.position = 'fixed';
                d.style.top = '50%';
                d.style.left = '50%';
                d.style.width = '200px';
                d.style.height = '60px';
                d.style.color = '#C0C0C0';
                d.style.fontFamily = 'Consolas, Verdana';
                d.style.zIndex = 999;
                d.style.margin = '-30px 0 0 -100px';
                d.style.fontSize = '20px';
                d.style.textAlign = 'center';
                d.className = 'nsi';
                document.body.appendChild(d);
                userInterface.gfxOverlay = d;

                window.lbf.innerHTML = '';
            } else {
                document.body.removeChild(userInterface.gfxOverlay);
                userInterface.gfxOverlay = undefined;
            }

            userInterface.gfxEnabled = !userInterface.gfxEnabled;
        },

        // Save variable to local storage
        savePreference: function (item, value) {
            window.localStorage.setItem(item, value);
            userInterface.onPrefChange();
        },

        // Load a variable from local storage
        loadPreference: function (preference, defaultVar) {
            var savedItem = window.localStorage.getItem(preference);
            if (savedItem !== null) {
                if (savedItem === 'true') {
                    window[preference] = true;
                } else if (savedItem === 'false') {
                    window[preference] = false;
                } else {
                    window[preference] = savedItem;
                }
                window.log('Setting found for ' + preference + ': ' + window[preference]);
            } else {
                window[preference] = defaultVar;
                window.log('No setting found for ' + preference +
                    '. Used default: ' + window[preference]);
            }
            userInterface.onPrefChange();
            return window[preference];
        },

        // Saves username when you click on "Play" button
        playButtonClickListener: function () {
            userInterface.saveNick();
            userInterface.loadPreference('autoRespawn', false);
            userInterface.onPrefChange();

            if (userInterface.server.value) {
                let s = userInterface.server.value.split(':');
                if (s.length === 2) {
                    window.force_ip = s[0];
                    window.force_port = s[1];
                    bot.connect();
                }
            } else {
                window.force_ip = undefined;
                window.force_port = undefined;
            }
        },

        // Preserve nickname
        saveNick: function () {
            var nick = document.getElementById('nick').value;
            userInterface.savePreference('savedNick', nick);
        },

        // Hide top score
        hideTop: function () {
            var nsidivs = document.querySelectorAll('div.nsi');
            for (var i = 0; i < nsidivs.length; i++) {
                if (nsidivs[i].style.top === '4px' && nsidivs[i].style.width === '300px') {
                    nsidivs[i].style.visibility = 'hidden';
                    bot.isTopHidden = true;
                    window.topscore = nsidivs[i];
                }
            }
        },

        // Store FPS data
        framesPerSecond: {
            fps: 0,
            fpsTimer: function () {
                if (window.playing && window.fps && window.lrd_mtm) {
                    if (Date.now() - window.lrd_mtm > 970) {
                        userInterface.framesPerSecond.fps = window.fps;
                    }
                }
            }
        },

        onkeydown: function (e) {
            // Original slither.io onkeydown function + whatever is under it
            original_keydown(e);
            if (window.playing) {
                // Letter `T` to toggle bot
                if (e.keyCode === 84) {
                    bot.isBotEnabled = !bot.isBotEnabled;
                }
                // Letter 'U' to toggle debugging (console)
                if (e.keyCode === 85) {
                    window.logDebugging = !window.logDebugging;
                    console.log('Log debugging set to: ' + window.logDebugging);
                    userInterface.savePreference('logDebugging', window.logDebugging);
                }
                // Letter 'Y' to toggle debugging (visual)
                if (e.keyCode === 89) {
                    window.visualDebugging = !window.visualDebugging;
                    console.log('Visual debugging set to: ' + window.visualDebugging);
                    userInterface.savePreference('visualDebugging', window.visualDebugging);
                }
                // Letter 'I' to toggle autorespawn
                if (e.keyCode === 73) {
                    window.autoRespawn = !window.autoRespawn;
                    console.log('Automatic Respawning set to: ' + window.autoRespawn);
                    userInterface.savePreference('autoRespawn', window.autoRespawn);
                }
                // Letter 'H' to toggle hidden mode
                if (e.keyCode === 72) {
                    userInterface.toggleOverlays();
                }
                // Letter 'G' to toggle graphics
                if (e.keyCode === 71) {
                    userInterface.toggleGfx();
                }
                // Letter 'O' to change rendermode (visual)
                if (e.keyCode === 79) {
                    userInterface.toggleMobileRendering(!window.mobileRender);
                }
                // Letter 'A' to increase collision detection radius
                if (e.keyCode === 65) {
                    bot.opt.radiusMult++;
                    console.log(
                        'radiusMult set to: ' + bot.opt.radiusMult);
                }
                // Letter 'S' to decrease collision detection radius
                if (e.keyCode === 83) {
                    if (bot.opt.radiusMult > 1) {
                        bot.opt.radiusMult--;
                        console.log(
                            'radiusMult set to: ' +
                            bot.opt.radiusMult);
                    }
                }
                // Letter 'Z' to reset zoom
                if (e.keyCode === 90) {
                    canvas.resetZoom();
                }
                // Letter 'Q' to quit to main menu
                if (e.keyCode === 81) {
                    window.autoRespawn = false;
                    userInterface.quit();
                }
                // 'ESC' to quickly respawn
                if (e.keyCode === 27) {
                    bot.quickRespawn();
                }
                userInterface.onPrefChange();
            }
        },

        onmousedown: function (e) {
            if (window.playing) {
                switch (e.which) {
                    // "Left click" to manually speed up the slither
                    case 1:
                        bot.defaultAccel = 1;
                        if (!bot.isBotEnabled) {
                            original_onmouseDown(e);
                        }
                        break;
                    // "Right click" to toggle bot in addition to the letter "T"
                    case 3:
                        bot.isBotEnabled = !bot.isBotEnabled;
                        break;
                }
            } else {
                original_onmouseDown(e);
            }
            userInterface.onPrefChange();
        },

        onmouseup: function () {
            bot.defaultAccel = 0;
        },

        // Manual mobile rendering
        toggleMobileRendering: function (mobileRendering) {
            window.mobileRender = mobileRendering;
            window.log('Mobile rendering set to: ' + window.mobileRender);
            userInterface.savePreference('mobileRender', window.mobileRender);
            // Set render mode
            if (window.mobileRender) {
                window.render_mode = 1;
                window.want_quality = 0;
                window.high_quality = false;
            } else {
                window.render_mode = 2;
                window.want_quality = 1;
                window.high_quality = true;
            }
        },

        // Update stats overlay.
        updateStats: function () {
            var oContent = [];
            var median;

            if (bot.scores.length === 0) return;

            median = Math.round((bot.scores[Math.floor((bot.scores.length - 1) / 2)] +
                bot.scores[Math.ceil((bot.scores.length - 1) / 2)]) / 2);

            oContent.push('games played: ' + bot.scores.length);
            oContent.push('a: ' + Math.round(
                bot.scores.reduce(function (a, b) { return a + b; }) / (bot.scores.length)) +
                ' m: ' + median);

            for (var i = 0; i < bot.scores.length && i < 10; i++) {
                oContent.push(i + 1 + '. ' + bot.scores[i]);
            }

            userInterface.overlays.statsOverlay.innerHTML = oContent.join('<br/>');
        },

        onPrefChange: function () {
            // Set static display options here.
            var oContent = [];
            var ht = userInterface.handleTextColor;

            oContent.push('version: ' + GM_info.script.version);
            oContent.push('[T] bot: ' + ht(bot.isBotEnabled));
            oContent.push('[O] mobile rendering: ' + ht(window.mobileRender));
            oContent.push('[A/S] radius multiplier: ' + bot.opt.radiusMult);
            oContent.push('[I] auto respawn: ' + ht(window.autoRespawn));
            oContent.push('[Y] visual debugging: ' + ht(window.visualDebugging));
            oContent.push('[U] log debugging: ' + ht(window.logDebugging));
            oContent.push('[Mouse Wheel] zoom');
            oContent.push('[Z] reset zoom');
            oContent.push('[ESC] quick respawn');
            oContent.push('[Q] quit to menu');

            userInterface.overlays.prefOverlay.innerHTML = oContent.join('<br/>');
        },

        onFrameUpdate: function () {
            // Botstatus overlay
            if (window.playing && window.snake !== null) {
                let oContent = [];

                oContent.push('fps: ' + userInterface.framesPerSecond.fps);

                // Display the X and Y of the snake
                oContent.push('x: ' +
                    (Math.round(window.snake.xx) || 0) + ' y: ' +
                    (Math.round(window.snake.yy) || 0));

                if (window.goalCoordinates) {
                    oContent.push('target');
                    oContent.push('x: ' + window.goalCoordinates.x + ' y: ' +
                        window.goalCoordinates.y);
                    if (window.goalCoordinates.sz) {
                        oContent.push('sz: ' + window.goalCoordinates.sz);
                    }
                }

                userInterface.overlays.botOverlay.innerHTML = oContent.join('<br/>');

                if (userInterface.gfxOverlay) {
                    let gContent = [];

                    gContent.push('<b>' + window.snake.nk + '</b>');
                    gContent.push(bot.snakeLength);
                    gContent.push('[' + window.rank + '/' + window.snake_count + ']');

                    userInterface.gfxOverlay.innerHTML = gContent.join('<br/>');
                }

                if (window.bso !== undefined && userInterface.overlays.serverOverlay.innerHTML !==
                    window.bso.ip + ':' + window.bso.po) {
                    userInterface.overlays.serverOverlay.innerHTML =
                        window.bso.ip + ':' + window.bso.po;
                }
            }

            if (window.playing && window.visualDebugging) {
                // Only draw the goal when a bot has a goal.
                if (window.goalCoordinates && bot.isBotEnabled) {
                    var headCoord = { x: window.snake.xx, y: window.snake.yy };
                    canvas.drawLine(
                        headCoord,
                        window.goalCoordinates,
                        'green');
                    canvas.drawCircle(window.goalCoordinates, 'red', true);
                }
            }
        },

        oefTimer: function () {
            var start = Date.now();
            canvas.maintainZoom();
            original_oef();
            if (userInterface.gfxEnabled) {
                original_redraw();
            } else {
                window.visualDebugging = false;
            }

            if (window.playing && bot.isBotEnabled && window.snake !== null) {
                window.onmousemove = function () { };
                bot.isBotRunning = true;
                bot.go();
            } else if (bot.isBotEnabled && bot.isBotRunning) {
                bot.isBotRunning = false;

                if (window.lastscore && window.lastscore.childNodes[1]) {
                    bot.scores.push(parseInt(window.lastscore.childNodes[1].innerHTML));
                    bot.scores.sort(function (a, b) { return b - a; });
                    userInterface.updateStats();
                }

                if (window.autoRespawn) {
                    bot.connect();
                }
            }

            if (!bot.isBotEnabled || !bot.isBotRunning) {
                window.onmousemove = original_onmousemove;
            }

            userInterface.onFrameUpdate();
            setTimeout(userInterface.oefTimer, (1000 / bot.opt.targetFps) - (Date.now() - start));
        },

        // Quit to menu
        quit: function () {
            if (window.playing && window.resetGame) {
                window.want_close_socket = true;
                window.dead_mtm = 0;
                if (window.play_btn) {
                    window.play_btn.setEnabled(true);
                }
                window.resetGame();
            }
        },

        handleTextColor: function (enabled) {
            return '<span style=\"color:' +
                (enabled ? 'green;\">enabled' : 'red;\">disabled') + '</span>';
        }
    };
})(window, document);

// Main
(function (window, document) {
    window.play_btn.btnf.addEventListener('click', userInterface.playButtonClickListener);
    document.onkeydown = userInterface.onkeydown;
    window.onmousedown = userInterface.onmousedown;
    window.addEventListener('mouseup', userInterface.onmouseup);

    // Hide top score
    userInterface.hideTop();

    // force server
    userInterface.initServerIp();
    userInterface.server.addEventListener('keyup', function (e) {
        if (e.keyCode === 13) {
            e.preventDefault();
            window.play_btn.btnf.click();
        }
    });

    // Overlays
    userInterface.initOverlays();

    // Load preferences
    userInterface.loadPreference('logDebugging', false);
    userInterface.loadPreference('visualDebugging', false);
    userInterface.loadPreference('autoRespawn', false);
    userInterface.loadPreference('mobileRender', false);
    window.nick.value = userInterface.loadPreference('savedNick', 'Slither.io-bot');

    // Listener for mouse wheel scroll - used for setZoom function
    document.body.addEventListener('mousewheel', canvas.setZoom);
    document.body.addEventListener('DOMMouseScroll', canvas.setZoom);

    // Set render mode
    if (window.mobileRender) {
        userInterface.toggleMobileRendering(true);
    } else {
        userInterface.toggleMobileRendering(false);
    }

    // Unblocks all skins without the need for FB sharing.
    window.localStorage.setItem('edttsg', '1');

    // Remove social
    window.social.remove();

    // Maintain fps
    setInterval(userInterface.framesPerSecond.fpsTimer, 80);

    // Start!
    userInterface.oefTimer();
})(window, document);
