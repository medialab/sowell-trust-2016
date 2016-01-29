if (!window.$ || !window._ || !window.IAT) {
  console.error('[Mango IAT] Dependencies (jQuery, Lodash, IAT.js) missing. Aborting...');
} else {
  var $ = window.$;
  var _ = window._;

  // If following marker exists in survey title, IAT single-page is triggered.
  var MARKER = 'IAT';

  $(function() {
    // Declare and/or assign parsable DOM node,
    // jQuery-wrapped DOM for building single page app,
    // object holding relevant element from the parsing
    // of the welcome page, and boolean flag to check
    // if preliminary work is done.
    var $content = $('#content');
    var $rootView = null;
    var welcomePageObject = {};
    var isReady = false;

    // Constants for keyboard inputs.
    var KEYCODE_E = 69;
    var KEYCODE_I = 73;

    // Storage for results gathering, matching and sending.
    var answerFormMatchingTextareas = [];
    var resultsFormData = {};

    // Reusable style snippet.
    var questionWrapperStyle = {
      width: '100%',
      background: 'none',
      'font-size': '16px',
      'text-align': 'center',
    };

    // Check to see we go further with SPA or quit.
    if (!verifyIfSinglePageAppIsRequired()) {
      return;
    }

    // If this point is reached, SPA is initializing.
    // Place an overlay on top of LimeSurvey's regular content,
    // and check if no error code is appearing in the page
    // (e.g. if we're not authorized to see the content) to
    // ensure we can proceed.
    console.info('[Mango IAT] Initializing.');
    replaceLimeSurveyLayout();
    if (!isReady) {
      return;
    }

    // Parse the welcome page and extract relevant data from it,
    // including form information to spoof submission via AJAX,
    // and DOM elements we need.
    welcomePageObject = getScrapedWelcomePage();

    // Set up a UI using parsed element.
    welcomePageObject.$el.css('width', '100%');
    $('.question_wrapper', welcomePageObject.$el)
      .css(questionWrapperStyle)
      .find('.navigator')
      .css({
        width: '100%',
        padding: 0,
      });
    $rootView.append(welcomePageObject.$el);

    // Hijack submit button to prevent regular form submission,
    // while fetching the actual POST result via ajax.
    // Get the HTML raw string as a result, DOMize it via jQuery,
    // and use it as a base to build jsPsych-related content.
    welcomePageObject.$nextBtn.on('click', function(e) {
      e.preventDefault();
      $.ajax({
        type: 'POST',
        url: welcomePageObject.requestUrl,
        data: welcomePageObject.requestBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).success(function(htmlString) {
        var $domExtract = $(extractNodeTree(htmlString));
        /*var answerFormMatchingTextareas = prepareFormAnswerMatching($domExtract);
        console.log('answerFormMatchingTextareas', answerFormMatchingTextareas);*/
        initIAT(parseForIAT($domExtract))
          .then(function(results) {
            console.log('results!!', results);
            resultsFormData = prepareFormAnswerPostData($(htmlString));

            var fieldNames = resultsFormData.fieldnames.split('|');
            fieldNames.forEach(function(fieldName, index) {
              resultsFormData[fieldName] = JSON.stringify(results[index]);
            });

            console.log('resultsFormData', resultsFormData)

            sendResultsToServer(resultsFormData).success(function(serverResponse) {
              var $serverResponse = $(serverResponse);
              var nextUrl = $serverResponse.find('#completed-url a').attr('href');
              if (nextUrl) {
                window.location.replace(nextUrl);
              }
            });
          });
      }).fail(function() {
        console.error('[Mango IAT] Fetching questions — request failed.');
        return dispose();
      });
    });

    function verifyIfSinglePageAppIsRequired() {
      return $('title').get(0).text.indexOf(MARKER) > -1;
    }

    function replaceLimeSurveyLayout() {
      console.log('[Mango IAT] Hiding LimeSurvey layout.');

      if (findPossibleStartupError()) {
        console.info('[Mango IAT] Looks like there is a LimeSurvey displayed on page. I\'m aborting...');
        return dispose();
      }

      isReady = true;

      $('body')
        .append('<div id="mangospa"></div>')
        .css({
          overflow: 'hidden',
        });

      $rootView = $('#mangospa');

      $rootView
        .css({
          position: 'absolute',
          overflow: 'auto',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          'background-color': '#CCC',
        });
    }

    function findPossibleStartupError() {
      var $errorMessage = $content.find('#tokenmessage .error');
      return $errorMessage.length > 0;
    }

    function getScrapedWelcomePage() {
      var $formNode = $content.find('form#limesurvey');
      var $nextBtn = $formNode.find('#movenextbtn');
      var $formInputs = $formNode.find('input');
      var formAction = $formNode.attr('action');
      var dataToPost = {};
      var promise = null;
      var moveNext = $nextBtn.attr('value');

      // Get a pivotal piece of data from
      // the 'next' button, to move LimeSurvey's
      // state manager.
      dataToPost[moveNext] = moveNext;

      // Create request body for POSTing.
      _.each($formInputs, function(input) {
        dataToPost[input.name] = input.value;
      });

      // Ensure form submit without clicking on our
      // hijacked button is void.
      $formNode.on('submit', function(e) {
        e.preventDefault();
      });

      return {
        requestBody: dataToPost,
        requestUrl: formAction,
        $el: $formNode,
        $nextBtn: $nextBtn,
      };
    }

    function extractNodeTree(htmlString) {
      var match = htmlString
                    .replace(/(\r\n|\n|\r|\s{3,})/gm, '')
                    .match(/<!-- START THE GROUP -->(.*)<!-- END THE GROUP -->/);

      return (match && match.length > 1) ? match[1] : '';
    }

    function parseItems(itemString) {
      var result = itemString.split(',')
        .map(function(item) {return item.trim();})
        .filter(function(item) {return item.length;});

      if (result.length < 2) {
        throw(new Error('not enough items in string'));
      }

      return result;
    }

    function createQuestionData() {
      return {
        test: [],
        order: [],
        splash: false,
        post: false,
      };
    }

    function parseQuestion($question) {
      var test = [];
      var questionSubData = {};

      // for each child element in the question container
      $question.children()
        .each(function(childIndex, child) {
          if (child.tagName[0] === 'H') {
            if (questionSubData.type) {
              console.warn('no item found for type', questionSubData.type);
            }

            questionSubData.type = child.innerHTML;
          } else if (questionSubData.type && !questionSubData.items) {
            var items;
            try {
              items = parseItems(child.textContent);
            }
            catch (error) {
            }

            if (items) {
              questionSubData.items = items;
            }
          }

          if (questionSubData.type && questionSubData.items) {
            test.push(questionSubData);
            questionSubData = {};
          }
        });

      return test;
    }

    // Look for the following type of pattern in a string:
    // "((A, B, A, A, B))" where A and B represent one concept and the opposite
    // (left word, right word displayed to user...).
    // This pattern gives the order of appearance of the stimuli.
    function parseOrderForQuestion(text) {
      var pattern = [];
      var match = /(?:\(\()([^\)].*)(?:\)\))/gi.exec(text);
      if (match && match[1]) {
        var order = match[1].replace(/\s/g, '');
        return order.split(',');
      }
      throw new Error('Parsing order for questions failed!');
    }

    function parseButton(text) {
      var match = /\[\[([^\]]+)\]\]/.exec(text);

      return match && match[1];
    }

    function parseHelp($help) {
      var result = {
        splash: false,
        post: false,
      };
      var keys = ['splash', 'post'];
      var currentIndex = 0;
      var $element;

      $help.children()
        .each(function(index, element) {
          $element = $(element);
          if (currentIndex > 1) {
            return;
          }

          if (element.tagName === 'HR') {
            currentIndex += 1;
          } else {
            if (!result[keys[currentIndex]]) {
              result[keys[currentIndex]] = {
                message: '',
              };
            }

            var currentScreen = result[keys[currentIndex]];

            var textButton = parseButton($element.text());
            if (textButton) {
              currentScreen.buttonText = textButton;
            } else if ($element.text().length) {
              var messagePart = $element.text().replace(
                /\{([^\}]+)\}/g,
                function(match, p1) {
                  return '{{' + p1.trim() + '}}';
                }
              );
              if (messagePart.trim().length) {
                messagePart = '<' + element.tagName + '>' + messagePart + '</' + element.tagName + '>';
                currentScreen.message += messagePart;
              }
            }
          }
        });

      keys.forEach(function(key) {
        if (!result[key] || !result[key].message.trim().length && !(result[key].buttonText && result[key].buttonText.length)) {
          result[key] = false;
        }
      });

      return result;
    }

    function parseForIAT($domTree) {
      var result = [];
      var helpData;
      var questionData = createQuestionData();
      var helpElements = $domTree.find('.anim_help');
      var $questions = $domTree.find('.question_wrapper');

      // for each question container
      $questions
        .each(function(questionIndex, questionElement) {
          var $questionElement = $(questionElement);
          questionData.test = parseQuestion($questionElement);
          questionData.order = parseOrderForQuestion($questionElement.text());
          helpData = parseHelp($(helpElements[questionIndex]));
          questionData.splash = helpData.splash;
          questionData.post = helpData.post;

          if (questionData.test.length === 2) {
            result.push(questionData);
            questionData = createQuestionData();
          }
        });

      if (result.length !== $questions.length) {
        console.error(
          "[Mango IAT]\nThere was a problem parsing DOM content for the questions.\n" +
          "One or more questions will not appear!\n" +
          "In LimeSurvey's admin, in the textarea for your questions,\ntoggle the 'source' " +
          "button and check you have a succession \nof 'h4' tags for title with 'div' tags for " +
          "the list of words. No nesting!"
        );
      }

      return result;
    }

    function initIAT(data) {
      $rootView.html('');
      return IAT.start($rootView, data, 'upload/templates/mango/scripts/iat.js/');
    }

    function prepareFormAnswerPostData($domTree) {
      var resultsFormData = {};

      // Value extracted from submit button,
      // needed to alter LimeSurvey's state manager.
      resultsFormData.movesubmit = 'movesubmit';

      _.each($domTree.find('input[type="hidden"]'), function(elm) {
        resultsFormData[elm.name] = elm.value;
      });

      return resultsFormData;
    }

    /*function prepareFormAnswerMatching($domTree) {
      var answerFormMatchingTextareas = [];
      _.each($domTree.find('.question.answer-item.text-item textarea'), function(textarea) {
        answerFormMatchingTextareas.push(textarea.name);
      });

      return answerFormMatchingTextareas;
    }*/

    function parseTestResults(rawData) {

    }

    function reconcileResults(answerFormMatchingTextareas, results) {
      var reconciled = {};

      _.each(answerFormMatchingTextareas, function(input, i) {
        reconciled[input.name] = JSON.stringify(results[i]);
      });

      return reconciled;
    }

    function sendResultsToServer(data) {
      return $.ajax({
        type: 'POST',
        url: welcomePageObject.requestUrl,
        data: data,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    }

    function renderClosingScreen($domTree) {
      $domTree = $domTree.find('.question_wrapper');
      $domTree.css(questionWrapperStyle);
      $rootView.html($domTree);
    }

    function dispose() {
      console.info('[Mango IAT] Stopping and cleaning up...');

      // TODO: clean up resources
    }

  }());
}
