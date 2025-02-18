defmodule OliWeb.ManualGrading.RenderedActivity do
  use Surface.LiveComponent

  prop rendered_activity, :any, required: true

  def render(%{rendered_activity: nil} = assigns) do
    ~F"""
      <div/>
    """
  end

  def render(assigns) do
    ~F"""
    <div class="mt-5 rendered-activity" id={@id} >{raw(@rendered_activity)}</div>
    """
  end

end
