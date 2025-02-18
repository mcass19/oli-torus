defmodule Oli.Delivery.Evaluation.RuleEvalTest do
  use ExUnit.Case, async: true

  alias Oli.Delivery.Evaluation.Rule
  alias Oli.Delivery.Evaluation.EvaluationContext

  defp eval(rule, input) do
    context = %EvaluationContext{
      resource_attempt_number: 1,
      activity_attempt_number: 1,
      part_attempt_number: 1,
      part_attempt_guid: "1",
      input: input
    }

    {:ok, tree} = Rule.parse(rule)

    case Rule.evaluate(tree, context) do
      {:ok, result} -> result
      {:error, e} -> {:error, e}
    end
  end

  test "evaluating integers" do
    assert eval("attemptNumber = {1} && input = {3}", "3")
    refute eval("attemptNumber = {1} && input = {3}", "4")
    refute eval("attemptNumber = {1} && input = {3}", "33")
    refute eval("attemptNumber = {1} && input = {3}", "3.3")
    assert eval("attemptNumber = {1} && input > {2}", "3")
    assert eval("attemptNumber = {1} && input < {4}", "3")
    refute eval("attemptNumber = {1} && input > {3}", "3")
    refute eval("attemptNumber = {1} && input < {3}", "3")
  end

  test "evaluating floats" do
    assert eval("attemptNumber = {1} && input = {3.1}", "3.1")
    refute eval("attemptNumber = {1} && input = {3.1}", "3.2")
    refute eval("attemptNumber = {1} && input = {3.1}", "4")
    refute eval("attemptNumber = {1} && input = {3.1}", "31")
    assert eval("attemptNumber = {1} && input > {2}", "3.2")
    assert eval("attemptNumber = {1} && input < {4}", "3.1")
    refute eval("attemptNumber = {1} && input > {3}", "3.0")
    refute eval("attemptNumber = {1} && input < {3}", "3.0")
  end

  test "evaluating ranges" do
    # scientific notation inside the range, evaluates to true
    assert eval("attemptNumber = {1} && input = {[3.0e5,4.0e5]}", "3.5e5") == true

    # float inside the range, evaluates to true
    assert eval("attemptNumber = {1} && input = {(3,4)}", "3.1") == true
    assert eval("attemptNumber = {1} && input = {(3.0,4)}", "3.1") == true
    assert eval("attemptNumber = {1} && input = {(3,4.0)}", "3.1") == true
    assert eval("attemptNumber = {1} && input = {(3.0,4.0)}", "3.1") == true

    # outside the range, evaluates to false
    assert eval("attemptNumber = {1} && input = {(3,4)}", "2.0") == false

    # same value as exclusive lower boundary, evaluates to false
    assert eval("attemptNumber = {1} && input = {(3,4)}", "3") == false
    assert eval("attemptNumber = {1} && input = {(3,4)}", "3.0") == false

    # same value as exclusive upper boundary, evaluates to false
    assert eval("attemptNumber = {1} && input = {(3,4)}", "4") == false
    assert eval("attemptNumber = {1} && input = {(3,4)}", "4.0") == false

    # same value as inclusive lower boundary, evaluates to true
    assert eval("attemptNumber = {1} && input = {[3,4]}", "3") == true
    assert eval("attemptNumber = {1} && input = {[3,4]}", "3.0") == true
    assert eval("attemptNumber = {1} && input = {[3.0,4.0]}", "3") == true

    # same value as inclusive upper boundary, evaluates to true
    assert eval("attemptNumber = {1} && input = {[3,4]}", "4") == true
    assert eval("attemptNumber = {1} && input = {[3,4]}", "4.0") == true
    assert eval("attemptNumber = {1} && input = {[3.0,4.0]}", "4") == true

    assert eval("attemptNumber = {1} && input = {(-4.66e-19,-4.5e-19)}", "-4.6e-19") == true



    # gracefully handles space in between range
    assert eval("attemptNumber = {1} && input = {[3, 5]}", "4") == true

    # handles negative numbers in range
    assert eval("attemptNumber = {1} && input = {[-3, 5]}", "0") == true
    assert eval("attemptNumber = {1} && input = {[-3, 5]}", "-3.1") == false
    assert eval("attemptNumber = {1} && input = {(-3, 5)}", "1") == true
    assert eval("attemptNumber = {1} && input = {[-3.75, 5.1111]}", "1") == true
    assert eval("attemptNumber = {1} && input = {(-3.75, 5.1111)}", "1.002") == true
    assert eval("attemptNumber = {1} && input = {[3.75, 5]}", "-1.002") == false

    # handles range with precision
    assert eval("attemptNumber = {1} && input = {[-5, 5]#4}", "1.002") == true
    assert eval("attemptNumber = {1} && input = {(100, 101)#5}", "100.20") == true
    assert eval("attemptNumber = {1} && input = {(100, 101)#3}", "100.1") == false
    assert eval("attemptNumber = {1} && input = {(-1, 1)#1}", "0") == true
    assert eval("attemptNumber = {1} && input = {(-1, 1)#1}", "0.0") == false
  end

  test "evaluating like" do
    assert eval("input like {cat}", "cat")
    refute eval("input like {cat}", "caaat")
    refute eval("input like {cat}", "ct")
    assert eval("input like {c.*?t}", "construct")
    refute eval("input like {c.*?t}", "apple")
  end

  test "evaluating numeric groupings" do
    assert eval("input = {1} || input > {1}", "1.5")
    assert eval("input = {1} || input > {1}", "1")
    refute eval("input = {1} || input > {1}", "0.1")
    refute eval("input = {11} || input > {11}", "1")

    assert eval("input = {1} || input < {1}", "0")
    assert eval("input = {1} || input < {1}", "1")
    refute eval("input = {1} || input < {1}", "1.5")
    refute eval("input = {1} || input < {1}", "1.1")
  end

  test "evaluating string groupings" do
    assert eval("attemptNumber = {1} && (input like {cat} || input like {dog})", "cat")
    assert eval("attemptNumber = {1} && (input like {cat} || input like {dog})", "dog")
  end

  test "evaluating negation" do
    assert eval("!(input like {cat})", "dog")
    assert !eval("!(input like {cat})", "cat")
  end

  test "evaluating complex groupings" do
    assert eval("input like {1} && (input like {2} && (!(input like {3})))", "1 2")
    assert eval("!(input like {1} && (input like {2} && (!(input like {3}))))", "1 3")
    assert eval("!(input like {1} && (input like {2} && (!(input like {3}))))", "1 2 3")
    assert eval("(!(input like {1})) && (input like {2})", "2")
  end

  test "evaluating input length" do
    assert eval("length(input) = {1}", "A")
    assert eval("length(input) < {10}", "Apple")
    assert eval("length(input) > {2}", "Apple")
  end

  test "evaluating string contains" do
    assert eval("input contains {cat}", "the cat in the hat")
    assert eval("input contains {cat}", "the CaT in the hat")
    assert eval("input contains {CaT}", "the cat in the hat")
    refute eval("input contains {cat}", "the bat in the hat")

    assert eval("!(input contains {cat})", "the bat in the hat")
    refute eval("!(input contains {cat})", "the cat in the hat")
  end

  test "evaluating strings with a numeric operator results in error" do
    {:error, _} = eval("input < {3}", "*50")
    {:error, _} = eval("input < {3}", "cat")
    {:error, _} = eval("input = {apple}", "apple")
  end

  test "evaluating float and integer precision" do
    # precision specified, should evaluate matching precision to true
    assert eval("attemptNumber = {1} && input = {3.1#2}", "3.1")

    # no precision specified, should evaluate extra precision to true
    assert eval("attemptNumber = {1} && input = {3.1}", "3.10")

    # precision specified, should evaluate extra precision to false
    refute eval("attemptNumber = {1} && input = {3.1#2}", "3.10")

    assert eval("attemptNumber = {1} && input = {0.001#4}", "0.001")
    assert eval("attemptNumber = {1} && input = {3.100#4}", "3.100")

    # eval returns false, although the precision is correct the value is wrong
    refute eval("attemptNumber = {1} && input = {3.268#2}", "3.2")
    refute eval("attemptNumber = {1} && input = {3.268#2}", "3.26")

    # eval returns false, although the value is correct, precision is wrong
    refute eval("attemptNumber = {1} && input = {3.268#2}", "3.268")

    # rule eval doesn't do any rounding, so these will return false
    refute eval("attemptNumber = {1} && input = {3.5#1}", "4")
    refute eval("attemptNumber = {1} && input = {3.25#2}", "3.3")

    # even though the value specified is more precise, the value and expected precision match
    assert eval("attemptNumber = {1} && input = {3.100#2}", "3.1")

    # even though the value specified is less precise, the value and expected precision match
    assert eval("attemptNumber = {1} && input = {2#2}", "2.0")

    # input is greater than, but precision is wrong
    refute eval("attemptNumber = {1} && input > {2#3}", "3.2")

    # input is less than, but precision is wrong
    refute eval("attemptNumber = {1} && input < {4#1}", "3.8")

    # precision is correct, but input is equal to
    refute eval("attemptNumber = {1} && input < {3#4}", "3.000")

    assert eval("attemptNumber = {1} && input < {4#2}", "3.1")
    assert eval("attemptNumber = {1} && input < {4#1}", "3")
    assert eval("attemptNumber = {1} && input > {3#2}", "3.1")
    assert eval("attemptNumber = {1} && input > {3#1}", "4")
  end
end
