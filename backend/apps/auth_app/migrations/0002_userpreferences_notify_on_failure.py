from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auth_app", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreferences",
            name="notify_on_failure",
            field=models.BooleanField(default=False),
        ),
    ]