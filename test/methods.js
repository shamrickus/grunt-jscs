"use strict";

var fixture, errors,
    grunt = require( "grunt" ),
    JSCS = require( "../tasks/lib/jscs" ).init( grunt ),

    path = require( "path" ),

    hooker = require( "hooker" ),

    newJSCS = function() {
        return new JSCS({
            config: newJSCS.config
        });
    };

function getFirstUnsupportedRule( config ) {
    newJSCS.config = config;

    return newJSCS().checker.getConfiguration().getUnsupportedRuleNames()[ 0 ];
}

module.exports = {
    setUp: function( done ) {
        fixture = new JSCS({
            config: "test/configs/fail.json"
        });

        fixture.execute( "test/fixtures/fixture.js" ).then(function( collection ) {
            fixture.setErrors( errors = collection );
            done();
        });

        // Once option from hooker won't work with exceptions
        hooker.hook( grunt, "fatal", {
            pre: function( message ) {
                throw new Error( message );
            }
        });
    },
    tearDown: function( done ) {
        hooker.unhook( grunt, "fatal" );
        done();
    },

    getConfig: function( test ) {
        var jscs, example;

        example = getFirstUnsupportedRule( "test/configs/example.json" );
        test.equal( example, "example", "should find config at local path" );

        example = getFirstUnsupportedRule(
            path.resolve( process.cwd(), "test/configs/example.json" )
        );
        test.equal( example, "example", "should find config at absolute path" );

        jscs = new JSCS({
            requireCurlyBraces: [ "if" ]
        }).getConfig();

        test.ok( Array.isArray( jscs.requireCurlyBraces ),
                "\"requireCurlyBraces\" option should have been preserved" );

        jscs = new JSCS({
            requireCurlyBraces: [ "if" ]
        }).getConfig();

        test.ok( !jscs.config, "config option should have been removed" );
        test.ok( Array.isArray( jscs.requireCurlyBraces ),
                "\"requireCurlyBraces\" option should have been preserved" );

        test.done();
    },

    "getConfig – error with incorrect config": function( test ) {
        newJSCS.config = "not-existed";

        test.throws( newJSCS, "The config file \"not-existed\" was not found",
            "should report that the config was not found" );

        test.done();
    },

    "getConfig – with empty config": function( test ) {
        newJSCS.config = "test/configs/empty.json";

        test.throws( newJSCS, "\"test/configs/empty.json\" config is empty",
            "should report that the config is empty" );

        test.done();
    },

    "getConfig – with inline options": function( test ) {
        var config = new JSCS({
            requireCurlyBraces: [ "if" ],
            config: "config",
            force: true,
            reporterOutput: "reporterOutput",
            reporter: ""
        }).getConfig();

        test.ok( !config.config, "config option should be removed" );
        test.ok( !config.force, "force option should be removed" );
        test.ok( !config.reporterOuput, "reporterOuput option should be removed" );
        test.ok( !config.reporter, "reporter option should be removed" );
        test.ok( !!config.requireCurlyBraces, "requireCurlyBraces should stay" );

        test.done();
    },

    "getConfig – merge inline and config options": function( test ) {
        var config = new JSCS({
            requireCurlyBraces: [ "if" ],
            config: "merge.json",
            disallowMultipleVarDecl: true
        }).getConfig();

        test.equal( config.requireCurlyBraces[ 0 ], "if",
            "inline option should rewrite config one" );
        test.ok( config.disallowMultipleVarDecl,
            "\"disallowMultipleVarDecl\" option should be present" );

        test.done();
    },

    findConfig: function( test ) {
        var example = getFirstUnsupportedRule( "test/configs/example.json" );
        test.equal( example, "example", "should find config at local path" );

        example = getFirstUnsupportedRule(
            path.resolve( process.cwd(), "test/configs/example.json" )
        );
        test.equal( example, "example", "should find config at absolute path" );

        test.done();
    },

    "findConfig - uses JSCS config loader": function( test ) {
        var example,
            cwd = process.cwd();

        grunt.file.setBase( "test/configs" );
        example = getFirstUnsupportedRule( null );
        test.equal( example, "example", "should read some config using JSCS loader" );

        example = getFirstUnsupportedRule( null );
        test.equal( example, "example", "should read some config using JSCS loader" );

        example = getFirstUnsupportedRule( "package.json" );
        test.equal( example, "example", "should read config from package.json jscsConfig key" );

        grunt.file.setBase( cwd );
        example = getFirstUnsupportedRule( "test/configs/.jscsrc" );
        test.equal( example, "example", "should read config with comments" );

        test.done();
    },

    "findConfig - throws if config option is falsy": function( test ) {
        newJSCS.config = false;

        test.throws( newJSCS, "Nor config file nor inline options weren't found",
            "should throw" );
        test.done();
    },

    registerReporter: function( test ) {
        var jscs = new JSCS({
            requireCurlyBraces: []
        });

        test.equal( typeof jscs.getReporter(), "function", "should register default reporter" );

        jscs = new JSCS({
            requireCurlyBraces: [],
            reporter: "checkstyle"
        });

        test.equal( typeof jscs.getReporter(), "function",
            "should register reporter from jscs package" );

        jscs = new JSCS({
            requireCurlyBraces: [],
            reporter: "test/test-reporter.js"
        });

        test.equal( jscs.getReporter()(), "test", "should register reporter as npm module" );

        test.done();
    },

    setErrors: function( test ) {
        var filteredErrors;

        errors.push( undefined );
        fixture.setErrors( errors );

        filteredErrors = fixture.getErrors();

        test.ok( filteredErrors.pop(), "should filter undefined values" );
        test.done();
    },

    count: function( test ) {
        fixture.setErrors( errors );

        test.equal( fixture.count(), 1, "should correctly count errors" );

        test.done();
    },

    report: function( test ) {
        hooker.hook( grunt.log, "writeln", {
            pre: function( message ) {
                test.ok( message, "Reporter should report something" );
                test.done();

                return hooker.preempt();
            },

            once: true
        });

        fixture.report();
    },

    "Default reporter should be outputable to the file (#23)": function( test ) {
        var jscs = new JSCS({
            reporterOutput: "#23",
            "requireCurlyBraces": [ "while" ]
        });

        jscs.execute( "test/fixtures/fixture.js" ).then(function( errorsCollection ) {

            // "grunt-contrib-nodeunit" package through which these tests are run,
            // Mutes grunt log actions so it wouldn't interfeare with tests output,
            // for our case this is not ideal since our default reporter uses grunt.log functions
            // this value will be changed when next test is run,
            // so there is no need to do this globally
            grunt.log.muted = false;

            jscs.setErrors( errorsCollection ).report();
            test.ok( grunt.file.read( "#23" ).length, "all output should be directed to the file" );

            grunt.file.delete( "#23" );

            test.done();
        });
    },

    notify: function( test ) {
        hooker.hook( grunt.log, "error", {
            pre: function( message ) {
                test.ok( message, "1 code style errors found!" );
                test.done();

                return hooker.preempt();
            },

            once: true
        });

        fixture.notify();
    },

    excludes: function( test ) {
        var jscs = new JSCS({
            "requireCurlyBraces": [ "while" ],
            "excludeFiles": [ "test/fixtures/exclude.js" ]
        });

        jscs.execute( "test/fixtures/exclude.js" ).then(function( errors ) {
            test.equal( jscs.setErrors( errors ).count(), 0,
                "should not find any errors in excluded file" );
            test.done();
        });
    },

    additional: function( test ) {
        var jscs = new JSCS({
            "additionalRules": [ "test/rules/*.js" ],
            "testAdditionalRules": true,
            config: "empty"
        });

        jscs.execute( "test/fixtures/fixture.js" ).then(function( errorsCollection ) {
            errorsCollection.forEach(function( errors ) {
                errors.getErrorList().forEach(function( error ) {
                    test.equal(
                        error.message,
                        "testAdditionalRules: test",
                        "should add additional rule"
                    );
                });
                test.done();
            });
        });
    },

    reporterOutput: function( test ) {
        var jscs = new JSCS({
            "requireCurlyBraces": [ "while" ],
            reporter: "checkstyle",
            reporterOutput: "test.xml"
        });

        jscs.execute( "test/fixtures/fixture.js" ).then(function( errorsCollection ) {
            jscs.setErrors( errorsCollection ).report();

            test.ok( grunt.file.exists( "test.xml" ), "test.xml should exist" );
            test.notEqual( grunt.file.read( "test.xml" ), "</checkstyle>\n",
                "test.xml should be more than last console.log" );
            grunt.file.delete( "test.xml" );

            test.done();
        });
    },

    "Don't break on syntax error": function( test ) {
        var jscs = new JSCS({
            "requireCurlyBraces": [ "while" ]
        });

        jscs.execute( "test/fixtures/broken.js" ).then(function( errorsCollection ) {
            errorsCollection.forEach(function( errors ) {
                test.equal(
                    errors.getErrorList()[ 0 ].message,
                    "Unexpected token (3:13)",
                    "should return correct syntax error"
                );

                test.done();
            });
        }).fail( test.done );
    }
};
