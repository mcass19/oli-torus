defmodule Oli.EditingTest do
  use Oli.DataCase

  alias Oli.Resources
  alias Oli.Resources.Revision
  alias Oli.Authoring.Editing.{PageEditor, ActivityEditor}
  alias Oli.Publishing
  alias Oli.Accounts.Author
  alias Oli.Accounts.SystemRole
  alias Oli.Utils.Time
  alias Oli.Authoring.Locks
  alias Oli.Authoring.Editing.ContainerEditor
  alias Oli.Publishing.AuthoringResolver

  describe "editing" do
    setup do
      map =
        Seeder.base_project_with_resource2()
        |> Seeder.add_objective("sub objective 1", :subobjective12A)
        |> Seeder.add_objective("sub objective 2", :subobjective2B)
        |> Seeder.add_objective_with_children("objective 1",[:subobjective12A], :objective1)
        |> Seeder.add_objective_with_children("objective 2", [:subobjective12A, :subobjective2B], :objective2)

      %{
        map: map,
        author: map.author,
        author2: map.author2,
        project: map.project,
        publication: map.publication,
        page1: map.page1,
        revision1: map.revision1,
        revision2: map.revision2
      }
    end

    test "edit/4 creates a new revision when no lock in place", %{
      author: author,
      revision1: revision1,
      project: project
    } do
      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "id" => "1",
            "children" => [
              %{"type" => "p", "children" => [%{"text" => "A paragraph."}]}
            ]
          }
        ]
      }

      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      {:ok, updated_revision} =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{"content" => content})

      assert revision1.id != updated_revision.id
    end

    test "editing page settings works when a second author edits a page that a first author is editing",
         %{
           page1: page1,
           revision1: revision1,
           author: author1,
           project: project,
           author2: author2
         } do
      original_revision = AuthoringResolver.from_resource_id(project.slug, page1.id)
      assert original_revision.graded == false
      # Author 1 starts editing the page
      PageEditor.acquire_lock(project.slug, revision1.slug, author1.email)

      some_new_content = %{
        "content" => %{
          "version" => "0.1.0",
          "model" => [
            %{
              "type" => "content",
              "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
            }
          ]
        }
      }

      PageEditor.edit(project.slug, revision1.slug, author1.email, some_new_content)

      author1_edit_revision = AuthoringResolver.from_resource_id(project.slug, page1.id)
      # Verify that editing created a new revision
      refute author1_edit_revision.id == original_revision.id
      assert author1_edit_revision.content == some_new_content["content"]

      # With author 1 still in an active editing session, author 2 makes container_editor driven edit:
      ContainerEditor.edit_page(project, author1_edit_revision.slug, %{
        graded: true,
        author_id: author2.id
      })

      author2_edit_revision = AuthoringResolver.from_resource_id(project.slug, page1.id)
      # Verify this edit created a new revision.
      refute author1_edit_revision.id == author2_edit_revision.id
      # Verify this edit has the correct content and graded edits
      assert author2_edit_revision.content == author1_edit_revision.content
      assert author2_edit_revision.graded == true
      # Now have author 1 make another edit:
      another_content = %{
        "content" => %{
          "version" => "0.1.0",
          "model" => [
            %{
              "type" => "content",
              "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
            }
          ]
        }
      }

      PageEditor.edit(project.slug, revision1.slug, author1.email, another_content)
      # Verify we get the same revision and all changes are present.
      author1_edit_revision = AuthoringResolver.from_resource_id(project.slug, page1.id)
      assert author1_edit_revision.id == author2_edit_revision.id
      assert author1_edit_revision.content == another_content["content"]
      assert author1_edit_revision.graded == true
    end

    test "edit/4 mark page delete and cascade to child activities", %{
      author: author,
      revision1: revision1,
      project: project
    } do
      content = %{"stem" => "Hey there"}

      {:ok, {revision, _}} =
        ActivityEditor.create(project.slug, "oli_multiple_choice", author, content, [])

      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      page_content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          },
          %{
            "activitySlug" => revision.slug,
            "id" => "2656470668",
            "children" => [],
            "purpose" => "none",
            "type" => "activity-reference"
          }
        ]
      }

      PageEditor.edit(project.slug, revision1.slug, author.email, %{"content" => page_content})

      deletion = %{deleted: true, author_id: author.id}
      PageEditor.edit(project.slug, revision1.slug, author.email, deletion)

      publication = Publishing.get_unpublished_publication_id!(project.id)
      latest_revision = ActivityEditor.get_latest_revision(publication, revision.resource_id)
      assert latest_revision.deleted
    end

    test "edit/4 properly handles deleted activities even when an edit to a duplicate", %{
      author: author,
      project: project,
      revision1: revision1
    } do
      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      title = "a new title"
      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      {:ok, updated_revision} =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{
          "title" => title,
          "content" => content
        })

      # read it back from the db and verify both edits were made
      from_db = Resources.get_revision!(updated_revision.id)

      assert "a new title" == from_db.title
      assert length(Map.get(from_db.content, "model")) == 1
    end

    test "edit/4 can edit multiple parameters", %{
      author: author,
      project: project,
      revision1: revision1
    } do
      content = %{
        "stem" => "1",
        "authoring" => %{
          "parts" => [
            %{
              "id" => "1",
              "responses" => [
                %{
                  "rule" => "input like {a}",
                  "score" => 10,
                  "id" => "r1",
                  "feedback" => %{"id" => "1", "content" => "yes"}
                },
                %{
                  "rule" => "input like {b}",
                  "score" => 1,
                  "id" => "r2",
                  "feedback" => %{"id" => "2", "content" => "almost"}
                },
                %{
                  "rule" => "input like {c}",
                  "score" => 0,
                  "id" => "r3",
                  "feedback" => %{"id" => "3", "content" => "no"}
                }
              ],
              "scoringStrategy" => "best"
            }
          ],
          "transformations" => []
        }
      }

      {:ok, {revision, _}} =
        ActivityEditor.create(project.slug, "oli_multiple_choice", author, content, [])

      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "activity-reference",
            "id" => "1",
            "activitySlug" => revision.slug
          }
        ]
      }

      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      {:ok, updated_revision} =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{
          "content" => content
        })

      PageEditor.release_lock(project.slug, revision1.slug, author.email)

      # Now create a duplicate project, and make an edit in that page that removes the activity
      {:ok, cloned_project} = Oli.Authoring.Clone.clone_project(project.slug, author)

      PageEditor.acquire_lock(cloned_project.slug, revision1.slug, author.email)

      {:ok, updated_revision2} =
        PageEditor.edit(cloned_project.slug, revision1.slug, author.email, %{
          "content" => %{
            "version" => "0.1.0",
            "model" => []
          }
        })

      refute updated_revision.id == updated_revision2.id

      # Reread the revision of the activity, and verify that it is not deleted
      refute Oli.Repo.get!(Oli.Resources.Revision, revision.id).deleted
    end

    test "edit/4 can handle string keys in the update map", %{
      author: author,
      revision1: revision1,
      project: project
    } do
      title = "a new title"
      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      {:ok, updated_revision} =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{"title" => title})

      # read it back from the db and verify both edits were made
      from_db = Resources.get_revision!(updated_revision.id)

      assert "a new title" == from_db.title
    end

    test "edit/4 reuses the same revision when the lock is in place", %{
      project: project,
      publication: publication,
      page1: page1,
      author: author,
      revision1: revision1
    } do
      # set the lock so that it is valid and held by the same user
      Publishing.get_published_resource!(publication.id, page1.id)
      |> Publishing.update_published_resource(%{
        lock_updated_at: Time.now(),
        locked_by_id: author.id
      })

      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      {:ok, updated_revision} =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{"content" => content})

      assert revision1.id == updated_revision.id
    end

    test "edit/4 generates a new revision when a lock has expired", %{
      project: project,
      publication: publication,
      page1: page1,
      author: author,
      revision1: revision1
    } do
      # set the lock so that it is valid and held by the same user
      Publishing.get_published_resource!(publication.id, page1.id)
      |> Publishing.update_published_resource(%{
        lock_updated_at: yesterday(),
        locked_by_id: author.id
      })

      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      {:ok, updated_revision} =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{"content" => content})

      assert revision1.id != updated_revision.id
    end

    test "edit/4 fails when the lock cannot be acquired or updated", %{
      project: project,
      author: author,
      author2: author2,
      publication: publication,
      page1: page1,
      revision1: revision1
    } do
      # set the lock so that it is valid and held by a different user
      {:acquired} = Locks.acquire(project.slug, publication.id, page1.id, author2.id)

      # now try to make the edit with the original user
      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      result =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{"content" => content})

      email = author2.email
      assert {:error, {:lock_not_acquired, {^email, _}}} = result
    end

    test "edit/4 releases the lock when 'releaseLock' present", %{
      project: project,
      author: author,
      author2: author2,
      revision1: revision1
    } do
      content = %{
        "version" => "0.1.0",
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      PageEditor.acquire_lock(project.slug, revision1.slug, author.email)

      result =
        PageEditor.edit(project.slug, revision1.slug, author.email, %{
          "content" => content,
          "releaseLock" => true
        })

      assert {:ok, _} = result

      PageEditor.acquire_lock(project.slug, revision1.slug, author2.email)

      result =
        PageEditor.edit(project.slug, revision1.slug, author2.email, %{"content" => content})

      assert {:ok, _} = result
    end

    test "edit/4 fails when the resource slug is invalid", %{project: project, author: author} do
      # try to make the edit on a resource that isn't found via a revision slug
      content = [
        %{
          "type" => "content",
          "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
        }
      ]

      result =
        PageEditor.edit(project.slug, "some_missing_slug", author.email, %{"content" => content})

      assert {:error, {:not_found}} = result
    end

    test "edit/4 fails when the project slug is invalid", %{author: author, revision1: revision1} do
      # try to make the edit on a resource that isn't found via a revision slug
      content = %{
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      result =
        PageEditor.edit("some_missing_slug", revision1.slug, author.email, %{"content" => content})

      assert {:error, {:not_found}} = result
    end

    test "edit/4 fails when the author doesn't have permission to edit", %{
      project: project,
      revision1: revision1
    } do
      # try to make the edit using an unauthorized author
      content = %{
        "model" => [
          %{
            "type" => "content",
            "children" => [%{"type" => "p", "children" => [%{"text" => "SECOND"}]}]
          }
        ]
      }

      {:ok, author2} =
        Author.noauth_changeset(%Author{}, %{
          email: "test3@test.com",
          given_name: "First",
          family_name: "Last",
          provider: "foo",
          system_role_id: SystemRole.role_id().author
        })
        |> Repo.insert()

      result =
        PageEditor.edit(project.slug, revision1.slug, author2.email, %{"content" => content})

      assert {:error, {:not_authorized}} = result
    end

    test "render_page_html/4 renders a page", %{
      project: project,
      revision2: revision,
      author: author
    } do
      html = PageEditor.render_page_html(project.slug, revision.content, author)

      assert html == [["<p>", [[[[], "Here" | "&#39;"] | "s some test content"]], "</p>\n"]]
    end

    test "construct_parent_references/1", %{
      map: %{
        objective1: %{revision: %Revision{resource_id: objective1_resource_id, title: objective1_title} = objective1},
        objective2: %{revision: %Revision{resource_id: objective2_resource_id, title: objective2_title} = objective2},
        subobjective12A: %{revision: %Revision{resource_id: subobjective12A_resource_id, title: subobjective12A_title} = subobjective12A},
        subobjective2B: %{revision: %Revision{resource_id: subobjective2B_resource_id, title: subobjective2B_title} = subobjective2B}
      }
    } do
      assert [
        %{id: subobjective2B_resource_id, parentId: objective2_resource_id, title: subobjective2B_title},
        %{id: subobjective12A_resource_id, parentId: objective1_resource_id, title: subobjective12A_title},
        %{id: subobjective12A_resource_id, parentId: objective2_resource_id, title: subobjective12A_title},
        %{id: objective2_resource_id, parentId: nil, title: objective2_title},
        %{id: objective1_resource_id, parentId: nil, title: objective1_title}
      ] ==
        PageEditor.construct_parent_references([objective1, objective2, subobjective12A, subobjective2B])
    end
  end
end
