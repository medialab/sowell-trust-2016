<?php
function sendBack($code, $msg, $order = null) {
  return json_encode([
    'status_code' => (int)$code,
    'message' => $msg,
    'order' => $order
  ]);
}


function nextOrder($experimentId) {
  $connParams = json_decode(file_get_contents('../../config.json'));

  $conn = mysqli_connect(
    $connParams->sDbHost,
    $connParams->sDbUser,
    $connParams->sDbPassword,
    $connParams->sDbDatabase
  );

  if (mysqli_connect_errno()) {
    echo sendBack(500, 'MySQL error: ' . mysqli_connect_error());
  }

  $query = "UPDATE mango_iat_panel_split SET iat_version = NOT(iat_version) WHERE experiment_id = $experimentId";

  $nextOrder = null;

  if ($conn->query($query)) {
    $query = "SELECT iat_version FROM mango_iat_panel_split WHERE experiment_id = $experimentId";
    if ($result = $conn->query($query)) {
      $nextOrder = null;
      while ($row = $result->fetch_row()) {
        $nextOrder = $row[0];
      }
      return $nextOrder;
    }

    echo sendBack(500, 'Error!');
  }

  echo sendBack(500, 'Error!');
}

if (isset($_POST['nextorder']) && isset($_POST['xpid'])) {
  $nextOrder = nextOrder((int)$_POST['xpid']);
  if ($nextOrder >= 0 && $nextOrder <= 1) {
    echo json_encode(['status_code' => 200, 'success' => true, 'order' => $nextOrder]);
  } else {
    echo json_encode(['status_code' => 500, 'success' => false, 'message' => 'Error while fetching new order.']);
  }
} else {
  echo json_encode([
    'status_code' => 401,
    'success' => false,
    'message' => 'Need to specify "nextorder" and "xpid" in request body'
  ]);
}


