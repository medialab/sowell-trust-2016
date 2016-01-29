<?php
/**
 * ResultsFacilitator PHP
 *
 * @author Davy P. Braun <davy.braun@sciencespo.fr>
 *
 * Receives results data from front-end via XHR each time a user submit a form.
 * Inserts a row in dedicated table (mango_results_facilitator) to enable getting
 * results calculated quicker by fetching data in a sustainable manner.
 */

/**
 * Ensure entry passed from XHR is clean and as expected.
 *
 * @param  array $entry The array representation of the POST payload.
 * @return array|bool If clean, the data is returned as is. `FALSE` is returned otherwise.
 */
function cleanEntry($entry) {
  if (!is_array($entry)) return false;
  if (count($entry) !== 4) return false;
  if (!array_key_exists('name', $entry)) return false;
  if (!array_key_exists('token', $entry)) return false;
  if (!array_key_exists('table', $entry)) return false;
  if (!array_key_exists('row', $entry)) return false;
  return $entry;
}

/**
 * Returns JSON payload as a response to the frontend request.
 *
 * @param  int    $code     HTTP status code.
 * @param  string $msg      An explanatory message of what happened.
 * @param  array  $payload  Original payload passed in.
 * @return JSON A response for the frontend.
 */
function sendBack($code, $msg, $payload) {
  return json_encode([
    'status_code' => (int)$code,
    'message' => $msg,
    'original_payload' => $payload
  ]);
}

/**
 * Insert entry into dedicated table in DB.
 *
 * @param  array $entry The array representation of the POST payload.
 * @return JSON On success or failure, returns a prepared JSON response matching the situation.
 */
function storeEntry($entry) {
  $connParams = json_decode(file_get_contents('../../config.json'));

  $conn = mysqli_connect(
    $connParams->sDbHost,
    $connParams->sDbUser,
    $connParams->sDbPassword,
    $connParams->sDbDatabase
  );

  if (mysqli_connect_errno()) {
    echo sendBack(500, 'MySQL error: ' . mysqli_connect_error(), $entry);
  }

  $query = "INSERT INTO mango_results_facilitator" .
           " (id, survey_name, user_token, matching_table_in_limesurvey, matching_row_in_table)" .
           " VALUES (NULL,'" . $entry['name'] . "', '" . $entry['token'] . "', '" . $entry['table'] .
           "', '" . $entry['row'] . "')";

  $code = 201;
  $msg = 'Successfully added to DB.';

  if (!mysqli_query($conn, $query)) {
    $code = 500;
    $msg = 'MySQL error: ' . mysqli_error($conn);
  }

  echo sendBack($code, $msg, $entry);
}

if (isset($_POST['entry'])) {
  $entry = cleanEntry($_POST['entry']);

  if (!$entry) {
    echo sendBack(400, 'Entry passed to results_facilitator.php is not valid.', $entry);
  }

  return storeEntry($entry);
} else {
  echo sendBack(500, 'No data was passed via POST!', null);
}
