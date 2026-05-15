from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("auth_app", "0002_userpreferences_notify_on_failure"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreferences",
            name="auto_upload_google_drive",
            field=models.BooleanField(default=False),
        ),
    ]