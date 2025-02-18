defmodule OliWeb.LegacyLogsController do
  use OliWeb, :controller

  import SweetXml

  def process(conn, _params) do

    doc = case Map.get(conn.assigns, :raw_body) do
      nil ->
        {:ok, raw_body, _conn} = Plug.Conn.read_body(conn, length: 20_000_000)
        raw_body
      raw_body -> raw_body
    end

    activity_attempt_guid = to_string(xpath(doc, ~x"//*/@external_object_id"))
    action = to_string(xpath(doc, ~x"//*/@action_id"))

    # Processing via oban task not neccessary here given that this http request
    # is only involved with this one single task
    Oli.Delivery.CustomLogs.Worker.perform_now(activity_attempt_guid, action, to_string(doc))

    conn
    |> put_resp_content_type("text/xml")
    |> send_resp(200, "status=success")

  end
end
