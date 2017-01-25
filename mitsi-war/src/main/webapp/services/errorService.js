angular.module('mitsiApp')
.service( 'errorService', function($rootScope, $timeout) {
	
	this.getGenericHttpErrorCallback = function() {
		return function(response) {
	    	$rootScope.mitsiGeneralError = "server error : "+response.status;
	    	// TODO : solution de facilité, il faudrait cacher les erreurs sur un évenement plus sympa qu'un timeout
			$timeout.cancel();
	    	$timeout(function() { 
				$rootScope.mitsiGeneralError = ""; 
			}, 30000);
		}
	}

	this.resetGeneralError = function(errorMessage) {
		$rootScope.mitsiGeneralError = "";
	}

	
	this.showGeneralError = function(errorMessage) {
		$rootScope.mitsiGeneralError = errorMessage;
    	// TODO : solution de facilité, il faudrait cacher les erreurs sur un évenement plus sympa qu'un timeout
		$timeout.cancel();
		$timeout(function() { 
			$rootScope.mitsiGeneralError = "";
		}, 30000);
	}
	
	
});