"use strict";

var angularAppIDX = angular.module('index', ['ui.bootstrap']);
angularAppIDX.controller('idListCtrl', function($scope, $http) {
	$scope.withSave = false;
	$scope.targetId = "";
    $scope.idList = [];
    $scope.show = true;
    $http.get('api/image/list').success(function(data) {
        $scope.idList = data.idList;
    });
    $scope.setTargetId = function(id) {
    	$scope.targetId = id;
    };
    $scope.isMenuOpened = false;
    $scope.onClickMenu = function() {
        $scope.isMenuOpened = !$scope.isMenuOpened;
    };
});
