defmodule OliWeb.RevisionHistory.Pagination do
  use Phoenix.LiveComponent

  alias OliWeb.RevisionHistory.PaginationLink

  defp render_none(assigns) do
    ~H"""
    <div></div>
    """
  end

  def render(assigns) do
    count = length(assigns.revisions)
    page_size = assigns.page_size

    if count > page_size do
      assigns =
        assigns
        |> assign(:current_page, div(assigns.page_offset, page_size) + 1)
        |> assign(
          :total_pages,
          div(count, page_size) +
            if rem(count, page_size) == 0 do
              0
            else
              1
            end
        )

      ~H"""
      <nav aria-label="table results paging">
        <ul class="pagination justify-content-center">
          <%= for page <- 1..@total_pages do %>
            <PaginationLink.render page_ordinal={page} active={@current_page == page} page_offset={@page_offset} />
          <% end %>
        </ul>
      </nav>
      """
    else
      render_none(assigns)
    end
  end
end
