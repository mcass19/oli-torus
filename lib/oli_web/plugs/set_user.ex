defmodule Oli.Plugs.SetCurrentUser do
  import Plug.Conn

  import Oli.Utils, only: [value_or: 2]

  alias Oli.Accounts
  alias Oli.Accounts.{Author, User}
  alias Oli.AccountLookupCache

  def init(_params) do
  end

  def call(conn, _params) do
    conn
    |> set_author
    |> set_user
    |> set_user_token
  end

  def set_author(conn) do
    with pow_config <- OliWeb.Pow.PowHelpers.get_pow_config(:author),
        %{id: author_id} <- Pow.Plug.current_user(conn, pow_config),
        {:ok, current_author} <- get_author(author_id) do
      conn
      |> put_session(:current_author_id, current_author.id)
      |> put_session(:is_community_admin, current_author.community_admin_count > 0)
      |> put_session(:is_system_admin, Accounts.is_admin?(current_author))
      |> assign(:current_author, current_author)
    else
      _ ->
        conn
        |> delete_session(:current_author_id)
        |> delete_session(:is_community_admin)
        |> delete_session(:is_system_admin)
        |> assign(:current_author, nil)
    end
  end

  def set_user(conn) do
    with pow_config <- OliWeb.Pow.PowHelpers.get_pow_config(:user),
         %{id: user_id} <- Pow.Plug.current_user(conn, pow_config),
         {:ok, current_user} <- get_user(user_id),
         active_datashop_session_id <- get_session(conn, :datashop_session_id) do
      conn
      |> put_session(:current_user_id, current_user.id)
      |> put_session(
        :datashop_session_id,
        value_or(active_datashop_session_id, UUID.uuid4())
      )
      |> assign(:current_user, current_user)
    else
      _ ->
        conn
        |> delete_session(:current_user_id)
        |> delete_session(:datashop_session_id)
        |> assign(:current_user, nil)
    end
  end

  defp get_author(author_id) do
    case AccountLookupCache.get("author_#{author_id}") do
      {:ok, %Author{}} = response -> response
      _ ->
        case Accounts.get_author_with_community_admin_count(author_id) do
          nil -> {:error, :not_found}
          author ->
            AccountLookupCache.put("author_#{author_id}", author)

            {:ok, author}
        end
    end
  end

  defp get_user(user_id) do
    case AccountLookupCache.get("user_#{user_id}") do
      {:ok, %User{}} = response -> response
      _ ->
        case Accounts.get_user_with_roles(user_id) do
          nil -> {:error, :not_found}
          user ->
            AccountLookupCache.put("user_#{user_id}", user)

            {:ok, user}
        end
    end
  end

  defp set_user_token(conn) do
    case conn.assigns[:current_user] do
      nil ->
        conn

      user ->
        token = Phoenix.Token.sign(conn, "user socket", user.sub)
        assign(conn, :user_token, token)
    end
  end
end
