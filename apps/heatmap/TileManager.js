TileManager = Class({
  initialize: function(source) {
    var manager = this;
    manager.source = source;

    manager.tiles = {};

    manager.events = new Events();
  },

  tilesPerScreenX: 2,
  tilesPerScreenY: 2,
  sortcols: ['series', 'datetime'],

  world: new Bounds(-180, -90, 180, 90),



  tileBoundsForRegion: function(bounds) {
    /* Returns a list of tile bounds covering a region. */

    var manager = this;

    var width = bounds.getWidth();
    var height = bounds.getHeight();
    var worldwidth = manager.world.getWidth();
    var worldheight = manager.world.getHeight();

    var level = Math.ceil(Math.max(log(worldwidth / (width/manager.tilesPerScreenX), 2), log(worldheight / (height/manager.tilesPerScreenY), 2)));

    var tilewidth = worldwidth / Math.pow(2, level);
    var tileheight = worldheight / Math.pow(2, level);
    
    var tileleft = tilewidth * Math.floor(bounds.left / tilewidth);
    var tileright = tilewidth * Math.ceil(bounds.right / tilewidth);
    var tilebottom = tileheight * Math.floor(bounds.bottom / tileheight);
    var tiletop = tileheight * Math.ceil(bounds.top / tileheight);

    var tilesx = (tileright - tileleft) / tilewidth;
    var tilesy = (tiletop - tilebottom) / tileheight;

    console.log({
      width: width,
      height: height,
      worldwidth: worldwidth,
      worldheight: worldheight,

      level: level,

      tilewidth: tilewidth,
      tileheight: tileheight,

      tileleft: tileleft,
      tileright: tileright,
      tilebottom: tilebottom,
      tiletop: tiletop,

      tilesx: tilesx,
      tilesy: tilesy
    });

    res = [];
    for (var x = 0; x < tilesx; x++) {
      for (var y = 0; y < tilesy; y++) {
        res.push(new Bounds(tileleft + x * tilewidth, tilebottom + y * tileheight, tileleft + (x+1) * tilewidth, tilebottom + (y+1) * tileheight));
      }
    }

    return res;
  },

  extendTileBounds: function (bounds) {
   /* Returns the first larger tile bounds enclosing the tile bounds
    * sent in. Note: Parameter bounds must be for a tile, as returned
    * by a previous call to tileBoundsForRegion or
    * extendTileBounds. */

    var manager = this;

    var tilewidth = bounds.getWidth() * 2;
    var tileheight = bounds.getHeight() * 2;

    var tileleft = tilewidth * Math.floor(bounds.left / tilewidth);
    var tilebottom = tileheight * Math.floor(bounds.bottom / tileheight);

    return new Bounds(tileleft, tilebottom, tileleft + tilewidth, tilebottom + tileheight);
  },

  zoomTo: function (bounds) {
    manager = this;
    manager.bounds = bounds;

    var tiles = {};
    manager.tileBoundsForRegion(bounds).map(function (tilebounds) {
      if (manager.tiles[tilebounds.toBBOX()] != undefined) {
        tiles[tilebounds.toBBOX()] = manager.tiles[tilebounds.toBBOX()];
      } else {
        tiles[tilebounds.toBBOX()] = manager.setUpTile(tilebounds);
      }
    });
    manager.tiles = tiles;

    // Merge any already loaded tiles
    manager.mergeTiles();

    manager.tileBoundsForRegion(bounds).map(function (tilebounds) {
      tiles[tilebounds.toBBOX()].load();
    });
  },

  setUpTile: function (tilebounds) {
    var manager = this;
    var tile = new Tile(manager, tilebounds);
    tile.events.on({
      "batch": function () { manager.handleBatch(tile); },
      "all": function () { manager.handleFullTile(tile); },
      "error": function (data) { manager.handleTileError(data, tile); },
      scope: manager
    });
    return tile;
  },

  handleBatch: function (tile) {
    var manager = this;

    manager.mergeTiles();
    manager.events.triggerEvent("batch", {"tile": tile});
  },

  handleFullTile: function (tile) {
    var manager = this;

    manager.mergeTiles();

    var all_done = manager.getTiles(
      ).map(function (tile) { return tile.value.header.length == tile.value.rowcount }
      ).reduce(function (a, b) { return a && b; });

    if (all_done) {
      manager.events.triggerEvent("all");
    } else {
      manager.events.triggerEvent("full-tile", {"tile": tile});
    }
  },

  handleTileError: function (data, tile) {
    var manager = this;

    tile.replacement = manager.setUpTile(manager.extendTileBounds(tile.bounds));
    tile.replacement.load();

    data.tile = tile;
    manager.events.triggerEvent("tile-error", data);
  },

  getTiles: function () {
    return Object.items(manager.tiles).map(function (tile) {
      while (tile.value.replacement != undefined) tile.value = tile.value.replacement;
      return tile;
    });
  },

  mergeTiles: function () {
    var manager = this;

    function compareTiles(a, b) {
      function compareTilesByCol(a, b, colidx) {
        if (colidx > manager.sortcols.length) return a;
        var col = manager.sortcols[colidx];
        if (a.value.data[col] == undefined || b.value.data[col] == undefined) {
          // Ignore any sort columns we don't have...
          return compareTilesByCol(a, b, colidx + 1);
        } else if (a.value.data[col][a.merged_rowcount] < b.value.data[col][a.merged_rowcount]) {
          return a;
        } else if (a.value.data[col][a.merged_rowcount] > b.value.data[col][a.merged_rowcount]) {
          return b;
        } else {
          return compareTilesByCol(a, b, colidx + 1);
        }
      }

      return compareTilesByCol(a, b, 0);
    }

    function nextTile(tiles) {
      res = tiles.reduce(function (a, b) {
        if (a.value.data == undefined || b.merged_rowcount >= b.value.rowcount) return a;
        if (b.value.data == undefined || a.merged_rowcount >= a.value.rowcount) return b;
        return compareTiles(a, b);
      });
      if (res.merged_rowcount >= res.value.rowcount) return undefined;
      res.merged_rowcount++;
      return res;
    }

    var start = new Date();

    var tiles = manager.getTiles().map(function (tile) {
      tile.merged_rowcount = 0;
      return tile;
    });

    manager.header = {length: 0, colsByName: {}};
    tiles.map(function (tile) {
      if (!tile.value.header) return;

      manager.header.length += tile.value.header.length;
      manager.header.colsByName = $.extend(manager.header.colsByName, tile.value.header.colsByName);
    });

    manager.data = {};
    for (var name in manager.header.colsByName) {
      var col = manager.header.colsByName[name];
      manager.data[name] = new col.typespec.array(manager.header.length);
    }

    manager.rowcount = 0;
    var tile;
    while (tile = nextTile(tiles)) {
      for (var name in manager.data) {
        if (tile.value.data[name] == undefined) {
          manager.data[name][manager.rowcount] = NaN;
        } else {
          manager.data[name][manager.rowcount] = tile.value.data[name][tile.merged_rowcount-1];
        }
      }
      manager.rowcount++;
    }

    var end = new Date();
      console.log("Merge: " + ((end - start) / 1000.0).toString());

  }
});

/*
tm = new TileManager("http://localhost/viirs/tiles");
tm.events.on({
    "tile-error": function (data) { console.log("tile-error: " + data.exception + " @ " + data.tile.bounds.toBBOX()); },
    "batch": function (data) { console.log("batch: " + data.tile.bounds.toBBOX()); },
    "full-tile": function (data) { console.log("full-tile: " + data.tile.bounds.toBBOX()); },
    "all": function () { console.log("all"); }
});
//tm.zoomTo(new Bounds(0, 0, 11.25, 11.25));
tm.zoomTo(new Bounds(-6, 0, 6, 11.25));
*/
