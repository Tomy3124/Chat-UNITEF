from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("avisos", "0003_aviso_directiva"),
    ]

    operations = [
        migrations.AddField(
            model_name="aviso",
            name="archivo",
            field=models.FileField(blank=True, null=True, upload_to="avisos/adjuntos/"),
        ),
    ]
