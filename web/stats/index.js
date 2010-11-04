/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Raindrop.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc..
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

/*jslint plusplus: false */
/*global require: false, location: true, window: false, alert: false */
"use strict";

require.def("stats",
        ["require", "jquery", "rdapi", "blade/jig"],
function (require,   $,        rdapi,   jig) {
    rdapi('stats/history', {
        data: {
            opts: 'domain'
        },
        success: function (json) {
            if (json.error) {
                $('#notifications').append(jig('#error', json.error));
            } else {
                $('#notifications').append(jig('#error', json.result));

                var w = 200,
                h = 200,
                r = w / 2
                
                var sum = pv.sum(json.map(function (d) d[0]));
                
                var vis = new pv.Panel()
                    .width(w)
                    .height(h)
                    .canvas("shares_per_domain");
                
                vis.add(pv.Wedge)
                    .data(json)
                    .left(w/2)
                    .bottom(w/2)
                    .outerRadius(r)
                    .angle(function(d) d[0] / sum * 2 * Math.PI)
                    .strokeStyle("white")
                    .lineWidth(4)
                  .anchor("center").add(pv.Label)
                    .text(function(d) d[1]+": "+(d[0] / sum * 100).toFixed(2)+"%");
                vis.render();

           }
        }
    });

    rdapi('stats/history', {
        success: function (json) {
            if (json.error) {
                $('#notifications').append(jig('#error', json.error));
            } else {
                $('#notifications').append(jig('#error', json.result));

                var max = pv.max(json.map(function (d) d[1]));
                var days = json.map(function (d) d[0]);
                
                /* Sizing and scales. */
                var w = 400,
                    h = 350,
                    btm = 100,
                    bsp = 2
                    bw = (w/json.length-1) - bsp;
                
                /* The root panel. */
                var vis = new pv.Panel()
                    .width(w)
                    .height(h)
                    .canvas("shares_per_day");
                
                /* The bars. */
                vis.add(pv.Bar)
                    .data(json)
                    .bottom(btm).width(bw)
                    .height(function(d) (d[1] / max) * h)
                    .left(function() this.index * (bw+bsp) + 20);
                
                /* y-axis and ticks. */
                var hmarks = 10;
                var interval = max/hmarks;
                var hspace = (h-btm)/interval/(hmarks-1);
                vis.add(pv.Rule)
                    .data(pv.range(0, max, interval))
                    .bottom(function(d) d * hspace + btm)
                    .strokeStyle("lightgrey")
                    .left(20)
                    .width(w-20)
                .anchor("left").add(pv.Label)
                    .visible(function(d) d > 0)
                    .text(function (d) d.toFixed());
                
                /* X-axis and ticks. */
                vis.add(pv.Rule)
                    .data(days)
                    .left(function() this.index * (bw+bsp) + 20 + bw/2)
                    .bottom(80)
                    .height(5)
                  .anchor("bottom").add(pv.Label)
                    .text(function (d) d)
                    .textAlign("left")
                    .textBaseline("middle")
                    .textAngle(Math.PI / 2)
                
                
                vis.render();

           }
        }
    });
    
    
});
