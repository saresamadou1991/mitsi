function MitsiGraph(relations) {
	this.nameTable = {};	
	this.vertexes = []; // BTW, should be vertices not vertexes
	
	this.createVertexIfNecessary = function(name) {
		var pos = this.nameTable[name];
		if(!pos) {
			pos = this.vertexes.length;
			this.nameTable[name] = pos;
			this.vertexes[pos] = { 
				"name"  : name,
				"links" : [],
				"reverseLinks" : []
			};
		}
	}
	
	// d'abord on crée une entrée pour chaque sommet
	for(var i=0; i!=relations.length; i++) {
		var relation = relations[i];
		
		this.createVertexIfNecessary(relation.tableOwner+"."+relation.tableName);
		this.createVertexIfNecessary(relation.rTableOwner+"."+relation.rTableName);
	
	}
	
	// ensuite on popule les relations de chaque sommet
	for(var i=0; i!=relations.length; i++) {
		var relation = relations[i];
		
		var pos  = this.nameTable[relation.tableOwner+"."+relation.tableName];
		var rpos = this.nameTable[relation.rTableOwner+"."+relation.rTableName];
		
		var newLink = {
			"target"     : rpos,
			"targetName" : relation.rTableOwner+"."+relation.rTableName,
			"properties" : {
				"keyColumns"  : relation.keyColumns.join(","),
				"rKeyColumns" : relation.rKeyColumns.join(",")
			}
		};
		
		var v = this.vertexes[pos];
		v.links.push(newLink);
		
		var newReverseLink = {
			"target"     : pos,
			"targetName" : relation.tableOwner+"."+relation.tableName,
			"properties" : {
				"keyColumns"  : relation.keyColumns.join(","),
				"rKeyColumns" : relation.rKeyColumns.join(",")
			}
		};

		var rv = this.vertexes[rpos];
		rv.reverseLinks.push(newReverseLink);

	}
	
	this.getLinksByName = function(tableOwner, tableName) {
		var pos = this.nameTable[tableOwner+(tableName?"."+tableName:"")];
		return this.vertexes[pos].links;
	}
	
	this.getLinks= function(index) {
		return this.vertexes[index].links;
	}
	
	this.getReverseLinksByName = function(tableOwner, tableName) {
		var pos = this.nameTable[tableOwner+(tableName?"."+tableName:"")];
		return this.vertexes[pos].reverseLinks;
	}
	
	this.getReverseLinks= function(index) {
		return this.vertexes[index].reverseLinks;
	}

	this.getIndex = function(tableOwner, tableName) {
		return this.nameTable[tableOwner+(tableName?"."+tableName:"")];
	}
	
	this.getVertexName = function(index) {
		return this.vertexes[index].name;
	}
	this.getVertex = function(index) {
		return this.vertexes[index];
	}
	
	this.getProximityGraph = function(index, depth) {
		var toexplore = [ index ];
		var explored = [];
		var before = [];
		var after = [];
		
		for(var i=0; i!=depth; i++) {
			var newBefore = [];
			var newAfter = [];
			var toexplorenext = [];

			for(var j=0; j!=toexplore.length; j++) {
				var exploreIndex = toexplore[j];
				explored.push(exploreIndex);
				var links = graph.getLinks(exploreIndex);
				var reverseLinks = graph.getReverseLinks(exploreIndex);
				
				for(var k=0; k!=links.length; k++) {
					var index = links[k].target;

					if(explored.indexOf(index) < 0 && toexplorenext.indexOf(index) < 0 && toexplore.indexOf(index) < 0) {
						newAfter.push(index);
						toexplorenext.push(index);
					}
				}
				
				for(var k=0; k!=reverseLinks.length; k++) {
					var index = reverseLinks[k].target;
					
					if(explored.indexOf(index) < 0 && toexplorenext.indexOf(index) < 0 && toexplore.indexOf(index) < 0) {
						newBefore.push(index);
						toexplorenext.push(index);
					}
				}
			}
			
			before[i] = newBefore;
			after[i] = newAfter;
			toexplore = toexplorenext;
			
		}
		
		return {
			"before" : before,
			"after"  : after
		};
	}
	
	this.computeDijkstra = function(startIndex, reverse) {
		var t = [];
		var visited = []
		var unvisited = [startIndex]
		
		t[startIndex] = { d:0, p:-1 };
		
		do {
			var current = unvisited.pop();
			visited[current] = true;
			
			var v = this.vertexes[current];
			var ls = reverse ? v.reverseLinks : v.links;
			for(var i=0; i!=ls.length; i++) {
				var l = ls[i];
				if(visited[l.target]) {
					continue;
				}
				
				if(!t[l.target] || t[l.target].d > t[current].d+1) {
					t[l.target] = { d:t[current].d+1, p:current };
				}
				unvisited.push(l.target);
			}
			
		} while(unvisited.length > 0);
		
		return t;
	}
	
	this.getPath = function(dijkstraTable, endIndex) {
		// TODO : trouver pourquoi dans le path on a parfois des entiers, parfois des string
		var path = [];
		
		var current = endIndex;
		path.push(current);
		while(dijkstraTable[current] && dijkstraTable[current].p != -1) {
			current = dijkstraTable[current].p;
			path.push(current);
		}
			
		return path.reverse();
	}
	
	this.computeEppstein = function(startIndex, endIndex, reverse) {
		var t = [];
		
		var tDijkstra = this.computeDijkstra(endIndex, !reverse);
		for(var i=0; i!=this.vertexes.length; i++) {
			
			var nt = {
				// d : tDijkstra[i].d, should be useless
				ls : []
			}
			
			var links = reverse ? this.vertexes[i].reverseLinks : this.vertexes[i].links;
			for(var l=0; l!=links.length; l++) {
				var target = tDijkstra[links[l].target];
				if(!target || target.d < 0) { // TODO target.d should not be <0
					// unreachable vertex
					continue;
				}

				nt.ls[l] = {
					t  : links[l].target,
					dt : 1 + target.d - tDijkstra[i].d
				};
			}
				
			if(nt.ls.length > 0) {
				t[i] = nt;
			}
		}
		
		
		
		
		return t;
	}
	
	this.getAllEqualsShortestPathBFS = function(tEppstein, path, endIndex) {
		var index = path[path.length-1];
		
		if(index == endIndex) {
			return [ path ];
		}

		var retPaths = [];
		for(var i=0; i!=tEppstein[index].ls.length; i++) {
			var l = tEppstein[index].ls[i];
			if(l.dt > 0) {
				continue;
			}
			
			var tPath = [];
			for(var j=0; j!=path.length; j++) {
				tPath[j] = path[j];
			}
			tPath[j] = l.t;
			
			var nextPaths = this.getAllEqualsShortestPathBFS(tEppstein, tPath, endIndex);

			for(var j=0; j!=nextPaths.length; j++) {
				retPaths.push(nextPaths[j]);
			}
		}
		
		return retPaths;
	}
	
	this.getAllEqualsShortestPath = function(tEppstein, startIndex, endIndex) {
		var path = [ startIndex ];
		var paths = this.getAllEqualsShortestPathBFS(tEppstein, path, endIndex);
		return paths;
	}
}