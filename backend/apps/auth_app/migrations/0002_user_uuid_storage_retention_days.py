import uuid

from django.db import migrations, models


def assign_user_uuids(apps, schema_editor):
    User = apps.get_model("auth_app", "User")
    for user in User.objects.filter(uuid__isnull=True):
        user.uuid = uuid.uuid4()
        user.save(update_fields=["uuid"])


class Migration(migrations.Migration):

    dependencies = [
        ("auth_app", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="uuid",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="storage_retention_days",
            field=models.PositiveIntegerField(
                default=7,
                help_text="Delete downloaded files after this many days (0 = keep forever). History rows are kept.",
            ),
        ),
        migrations.RunPython(assign_user_uuids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="uuid",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
