/**
 * ResultsFacilitator
 *
 * @author Davy P. Braun <davy.braun@sciencespo.fr>
 *
 * Whenever a form is submitted in a survey using the Mango template,
 * this scripts snoops into the data being passed in the request and
 * decypher it to prepare the arguments for storing down the road a set
 * of SQL statements.
 * These SQL statements will facilitate fetching all the results from
 * all the surveys passed by each user in this experiments.
 */
$(function() {
  var $forms = $('form');

  console.warn(
    "To monitor results_facilitator's requests, make sure you checked 'Preserve Log' in dev console."
  );

  $forms.submit(function(e) {
    var $form = $(e.originalEvent.target);
    var token = $form.find('input[type="hidden"][name="token"]');
    var fieldnames = $form.find('input[type="hidden"][name="fieldnames"]');

    var hasSubmitted = (function() {
      var $b = $('#movenextbtn');
      return $b.length > 0;
    }());

    if (hasSubmitted) {
      var surveyName = $('title').text();
      var data = {
        entry: {
          name: surveyName,
          token: token.val(),
          table: 'lime_survey_' + fieldnames.val().split('|')[0].split('X')[0],
          row: fieldnames.val()
        }
      };

      console.log('Sending data to results_facilitator:', data);

      $.post('/mango/mango_surveys_router/services/results_facilitator.php', data)
       .done(function(data) {
         console.log(JSON.parse(data));
       })
       .fail(function() {
         console.error('Data sending failed...');
       })
    }
  });
});
