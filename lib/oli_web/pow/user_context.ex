defmodule OliWeb.Pow.UserContext do
  @moduledoc """
  Custom module that handles pow users context for user.
  """

  use Pow.Ecto.Context,
    repo: Oli.Repo,
    user: Oli.Accounts.User

  alias Oli.Accounts
  alias Oli.Accounts.User
  alias Oli.Delivery.Sections
  alias Oli.Delivery.Sections.Section
  alias Oli.Repo

  require Logger

  @doc """
  Overrides the existing pow get_by/1 and ensures only
  independent learners are queried
  """
  @impl true
  def get_by(clauses) do
    clauses = Keyword.put_new(clauses, :independent_learner, true)

    pow_get_by(clauses)
  end

  @spec lock(map()) :: {:ok, map()} | {:error, map()}
  def lock(user) do
    user
    |> User.lock_changeset()
    |> Repo.update()
  end

  @spec unlock(map()) :: {:ok, map()} | {:error, map()}
  def unlock(user) do
    user
    |> User.noauth_changeset(%{locked_at: nil})
    |> Repo.update()
  end

  @doc """
  Overrides the default Pow.Ecto.Context `create` to set the virtual `enroll_after_email_confirmation`
  field after a user is created as part of an independent enrollment email confirmation
  """
  @impl true
  def create(params) do
    params =
      with %{"section" => section_slug} <- params,
          %Section{skip_email_verification: true} <- Sections.get_section_by_slug(section_slug) do
        email_confirmed_at = DateTime.truncate(DateTime.utc_now(), :second)
        Map.put(params, "email_confirmed_at", email_confirmed_at)
      else
        _ -> params
      end

    %User{}
    |> User.verification_changeset(params)
    |> Repo.insert()
    |> case do
      {:ok, user} ->
        if Application.fetch_env!(:oli, :age_verification)[:is_enabled] == "true" do
          Logger.info(
            "User (id: #{user.id}, email: #{user.email}) created successfully with age verification"
          )
        end

        case params do
          %{"section" => section} ->
            # set the `enroll_after_email_confirmation` virtual field from the given section param
            {:ok, Map.put(user, :enroll_after_email_confirmation, section)}

          _ ->
            {:ok, user}
        end

      {:error, error} ->
        {:error, error}
    end
  end

  @impl true
  def update(user, attrs),
    do: Accounts.update_user(user, attrs)
end
