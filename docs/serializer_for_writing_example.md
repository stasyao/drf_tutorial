## Пример API для записи данных

В этом разделе мы закрепим теорию из предыдущей части на простом примере, а также затронем ранее не рассмотренные вопросы:
- какое поле сериалайзера выбрать для `ForeignKey`-поля модели;
- как сериалайзер работает с датами;
- как устроен метод `save` сериалайзера;
- напишем контроллер, который будет обрабатывать запросы к API на создание записи в БД.

**Важное замечание**: мы по-прежнему работаем с базовым классом сериалайзера, не переходя к более высокому уровню абстракции &mdash; `ModelSerializer`. Это нужно, чтобы глубже понимать принципы работы DRF и суметь, при необходимости, провести тонкую настройку сериалайзера. О `ModelSerializer` мы очень подробно поговорим в следующей статье.

Исходный код учебного проекта для этой статьи [доступен в гитхаб](https://github.com/stasyao/drf_guide_part_2).

### Объявляем класс сериалайзера
```py
from rest_framework import serializers


class WriterSerializer(Serializer):
    pass
```

Смотрим, какие поля у нас есть в модели, куда будут записываться пришедшие в запросе данные (*класс модели приведен в сокращении*).

```python
class Writer(models.Model):
    firstname = models.CharField(max_length=100...)
    lastname = models.CharField(max_length=100...)
    patronymic = models.CharField(max_length=100...)
    birth_place = models.ForeignKey(to=Town...)
    birth_date = models.DateField(...)
```

Итак, нам нужно, чтобы в POST-запросе пришли данные для 5-ти полей.  

### Подбираем корреспондирующие поля сериалайзера

Каждое поле сериалайзера мы назовем также как поле модели, которое оно обслуживает.  
Это позволит не указывать дополнительный атрибут `source` и сразу записывать в базу прошедшие через сериалайзер данные. 

#### Поля `firstname`, `lastname`, `patronymic`  

Одноименные поля модели ожидают обычные строковые значения, поэтому для корреспондирующих полей сериалайзера выберем класс `serializers.Charfield`. 

Заглянем в [метод `__init__`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/fields.py#L773) класса, чтобы определиться с аргументами при создании поля.

```python
    def __init__(self, **kwargs):
        self.allow_blank = kwargs.pop('allow_blank', False)
        self.trim_whitespace = kwargs.pop('trim_whitespace', True)
        self.max_length = kwargs.pop('max_length', None)
        self.min_length = kwargs.pop('min_length', None)
        ...
```

- `allow_blank` трогать не будем, нам нужны данные, устраивает дефолтный `False`.  
- `trim_whitespace` обрежет пробелы перед и после текста, нам это подходит, поэтому атрибут также не трогаем, оставляем дефолтный `True`. 
- `max_length` нам нужен, т.к. такой же валидатор стоит у каждого текстового поля модели `Writer`. Поскольку по дефолту он не задан, объявим его явно и приведем лимит по количеству символов (такой же как и в модели).  
- `min_length` нам не требуется, ограничений по минимальному количеству символов для полей модели нет.

Получаем следующий код:

```python
class WriterSerializer(serializers.Serializer):
    firstname = serializers.CharField(max_length=100)
    patronymic = serializers.CharField(max_length=100)
    lastname = serializers.CharField(max_length=100)
```

#### Поле `birth_place`

Одноименное поле модели относится к классу `ForeignKey` и связано с моделью `Town`. 

```python
class Writer(models.Model):
    ...
    birth_place = models.ForeignKey(to=Town...)

class Town(models.Model):
    name = models.CharField(max_length=100, unique=True, ...)
```

Нам нужно не просто передать какое-то значение (тот же текст), которое сразу запишется в базу. Нам нужно, чтобы по этому значению была извлечен объект записи из модели `Town`.  

Для работы с полями с отношениями DRF предоставляет [несколько классов полей](https://www.django-rest-framework.org/api-guide/relations/#serializer-relations).  

Нам подходит класс `SlugRelatedField`. Описание из [исходного кода](https://github.com/encode/django-rest-framework/blob/master/rest_framework/relations.py#L446): `A read-write field that represents the target of the relationship by a unique 'slug' attribute`. Слово `slug` может немного путать. Под `slug` здесь понимается любое уникальное поле модели с любым названием (совсем не обязательно, чтобы оно называлось `slug` или относилось к классу `SlugField`).  

В предыдущей статье мы разобрали, что при работе сериалайзера на запись в поле любого класса работает метод `to_internal_value`.  
Вот его [исходный код](https://dvmn.org/user/id583135246/) для класса `SlugRelatedField`: 

```python
def to_internal_value(self, data):
    queryset = self.get_queryset()
    try:
        return queryset.get(**{self.slug_field: data})
    except ObjectDoesNotExist:
        self.fail('does_not_exist', slug_name=self.slug_field, value=smart_str(data))
    except (TypeError, ValueError):
        self.fail('invalid')
```

Код даёт понимание, какие атрибуты нам следует передать. Нужны:
- `queryset` &mdash; набор записей (разумеется, из связанной модели);
- `slug_field` &mdash; имя уникального поля в связанной модели, которое будет использоваться для ORM-запроса `.get`. Всегда можно указать `pk` или `id`, но у нас есть уникальное поле `name`, выберем его. 

Что касается набора записей, мы будем искать объект `Town` по всем записям, поэтому передадим `Town.objects.all()`, хотя вполне можно сократить до `Town.objects`, т.к. `all()` будет вызван [под капотом](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/relations.py#L164).

Итог: 

```python
class WriterSerializer(serializers.Serializer):
    ...
    birth_place = serializers.SlugRelatedField(slug_field='name', queryset=Town.objects)
```
#### Поле `birth_date`
В джанго-модели поле `birth_date` относится к классу `DateField`. Одноименный класс [предусмотрен](https://www.django-rest-framework.org/api-guide/fields/#datetimefield) и среди полей сериалайзера.

При объявлении поля `DateField` можно передать два необязательных аргумента:
- `format` &mdash; формат, в котором дата будет возвращаться при работе сериалайзера на чтение;
- `input_formats` &mdash; список или кортеж допустимых форматов передачи даты при работе сериалайзера на запись.  

Поскольку акцент в статье на работу сериалайзера на запись, рассмотрим подробнее второй аргумент. Если его не передать, то используется настройка из-под капота `DATE_INPUT_FORMATS`, которая позволяет передавть дату в формате `iso-8601`, проще говоря, строкой вида `YYYY-MM-DD`. 

Чтобы глобально переопределить это поведение, нужно прописать в настройках DRF собственные форматы (они должны отвечать [требованиям](https://docs.python.org/3/library/datetime.html#strftime-and-strptime-format-codes) Python-модуля `datetime`). 

[Все настройки DRF](https://www.django-rest-framework.org/api-guide/settings/#settings) прописываются в `settings.py` джанго-проекта, в словаре `REST_FRAMEWORK`. Перенастроим формат передачи строки с датой:
```python
# settings.py
REST_FRAMEWORK = {
    'DATE_INPUT_FORMATS': [
        '%d.%m.%Y',  # '25.10.2021'
        '%d.%m.%y',  # '25.10.21'
    ]
}
```
Для большей выразительности примера мы переопределим формат ввода/вывода даты не глобально, а прямо в поле сериалайзера.
```python
birth_date = serializers.DateField(
    format='%d.%m.%Y', # из базы дата будет вытаскиваться в формате "25.10.2021"
    input_formats=['%d.%m.%Y', 'iso-8601',] # в том же виде сериалайзер ожидает дату "на вход", но можно и дефолтный формат
)
```

[Под капотом](https://github.com/encode/django-rest-framework/blob/master/rest_framework/fields.py#L1250) `DateField` переданная строка превратится с помощью `datetime.datetime.strptime` в объект класса `datetime.date`.  

#### Собираем все поля вместе и проверяем работу сериалайзера
Код нашего сериалайзера получился таким:

```python
class WriterSerializer(serializers.Serializer):
    firstname = serializers.CharField(max_length=100)
    lastname = serializers.CharField(max_length=100)
    patronymic = serializers.CharField(max_length=100)
    birth_place = serializers.SlugRelatedField(
        slug_field='name',
        queryset = Town.objects
    )
    birth_date = serializers.DateField(
        format='%d.%m.%Y',
        input_formats=['%d.%m.%Y']
    )
```

Сериалайзер может работать и на запись, и на чтение, `read only` или `write only` полей нет. Проверим.

Создадим сериалайзер **на чтение**, понадобится запись из базы и аргумент `instance`
(в каких случаях нужен тот или иной аргумент при создании сериалайзера мы подробно рассматривали в предыдущей статье). 
```py
instance = Writer.objects.first()
serializer_for_reading = WriterSerializer(instance=instance)
print(serializer_read.data)
```
Результат: 
```py
{
    'firstname': 'Константин',
    'patronymic': 'Николаевич',
    'lastname': 'Батюшков',
    'birth_place': 'Вологда',
    'birth_date': '29.05.1787'
}
```
Создадим сериалайзер **на запись**. Понадобится словарь с входными данными и аргумент `data`. 
```py
data = {
    'firstname': 'Иван',
    'patronymic': 'Алексеевич',
    'lastname': 'Бунин',
    'birth_place': 'Воронеж',
    'birth_date': '22.10.1870'
}
serializer_for_writing = WriterSerializer(data=data)
# валидируем входные данные
print(serializer_for_writing.is_valid()) # True
print(serializer_for_writing.errors) # ожидаемо пустой словарь {}
```

Посмотрим, что в `validated_data` (обработанные сериалайзером даннные, готовые к записи в БД):

```
# serializer_for_writing.validated_data
OrderedDict(
    [
        ('firstname', 'Иван'),
        ('patronymic', 'Алексеевич'),
        ('lastname', 'Бунин'),
        ('birth_place', <Town: Воронеж>),
        ('birth_date', datetime.date(1870, 10, 22))
    ]
)
```
Видим, что в `birth_place` теперь не строка "Воронеж", а объект модели `Town`, готовый для записи в поле с внешним ключом `birth_place`. А в поле `birth_date` не строка с датой, а объект класса `datetime.date`.  

Попробуем передать невалидные данные, например, для поля `birth_date` придёт строка в неправильном формате (допустим, `22/10/1870`). 
`is_valid` вернет `False`, а словарь `errors` будет таким:

```python
{
    'birth_date': [
        ErrorDetail(string='Неправильный формат date. Используйте один из этих форматов: DD.MM.YYYY.', 
                    code='invalid')
    ]
}
```

Все поля сериалайзера отработали штатно.

### Усиливаем валидацию 
В предыдущей статье мы очень подробно рассказали о многоступенчатой системе валидации в DRF-сериалайзере. Попрактикуемся в прикручивании валидаторов на разных этапах проверки входных данных.

**Валидатор для конкретного поля**. Допустим, нас интересуют только писатели, родившиеся не позднее 20 века. Для проверки этого условия добавим аргумент `validators` в поле `birthdate`.
```python
from datetime import date
from django.core.validators import MaxValueValidator
...
class WriterSerializer(serializers.Serializer):
    ...
    birth_date = serializers.DateField(..., validators=[MaxValueValidator(date(1999, 12, 31))])
```

**Метавалидатор**. Мы хотим, чтобы сочетание "имя-отчество-фамилия" было уникальным. Здесь пригодится `UniqueTogetherValidator`, который следует объявить в классе `Meta` сериалайзера (а до этого импортировать из `rest_framework.validators`).
```python
class WriterSerializer(serializers.Serializer):
    ...
    class Meta:
        validators = [
            UniqueTogetherValidator(
                queryset=Writer.objects,
                fields=['firstname', 'patronymic', 'lastname']
            ) 
        ]  
```

**Заключительная валидация методом validate**. Напоследок мы хотим проверить, что имя, фамилия и отчество не повторяются между собой. 

Напомню, что в `attrs` находится упорядоченный словарь с прошедшими все предыдущие проверки данными.  
```python
class WriterSerializer(serializers.Serializer):
    ...
    class Meta:
        ...
    def validate(self, attrs):
        set_attrs = set(
            [attrs['firstname'], attrs['patronymic'], attrs['lastname']]
        )
        if len(set_attrs) != 3:
            raise ValidationError(
                'Имя, отчество и фамилия не могут совпадать между собой',
                code='duplicate values'
            )
        return attrs
```
### Добавляем сериалайзеру возможность записывать валидированные данные в БД  

DRF-класс `Serializer` наследует от класса `BaseSerializer`, у которого есть метод [`save`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L179). Но вызвать его напрямую мы пока не можем. Чтобы метод заработал, внутри класса нашего сериалайзера нужно описать методы:
- [`create`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L212) с логикой сохранения в БД новой записи;
- [`update`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L207) с логикой обновления в БД существующей записи. 

Примеры этих методов есть в [документации](https://www.django-rest-framework.org/api-guide/serializers/#saving-instances).

Сейчас нам достаточно лишь записывать в БД новые данные, поэтому определим только метод `create`:

```python
class WriterSerializer(serializers.Serializer):
    # тут определения полей сериалайзера, класс Meta, метод validate. Пропускаем для краткости
    
    def create(self, validated_data):
       return Writer.objects.create(**validated_data)
```

Теперь при вызове у экземпляра сериалайзера метода `.save()` (аргументы не нужны) и он вернет новую запись. Вызывать метод `save` можно [только после получения](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L180) валидированных данных, т.е. после вызова `is_valid`. 

Разработчики DRF [отмечают](https://www.django-rest-framework.org/api-guide/serializers/#overriding-save-directly): логика `save` абсолютно не исчерпывается созданием или обновлением записи в БД. Можно вообще не описывать методы `create` и `update`, а целиком переопределить сам `save`. Например, для того, чтобы при его вызове валидированные данные отправлялись по электронной почте. 

### Контроллер и Browsable API

В первой статье, где демонстрировался пример работы DRF на чтение, мы использовали самый простой контроллер на основе класса `APIView`. 
Задействуем его и в этот раз &mdash; понадобится лишь дописать логику метода `post`

Для работы с `POST`-запросами в `Browsable API` есть удобная вкладка `HTML form`, предоставляющее для каждого поля сериалайзера отдельное поле в форме. 

Чтобы эта вкладка [отрендерилась в шаблоне](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/templates/rest_framework/base.html#L186) в контроллере [должен присутствовать](https://github.com/encode/django-rest-framework/blob/master/rest_framework/renderers.py#L486) атрибут `get_serializer` или `serializer_class`. 

Для высокоуровневых контроллеров, начиная с `GenericAPIView` эти атрибуты есть под капотом. Поскольку мы используем "голый" `APIView`, то допишем необходимый атрибут самостоятельно.
```python
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Writer
from .serializers import WriterSerializer


class WriterInfoView(APIView):
    serializer_class = WriterSerializer
    model = Writer

    def get(self, request):
        ... # полный код не приводим он аналогичен коду из первой статье о работе API на чтение

    def post(self, request):
        serializer_for_writing = self.serializer_class(data=request.data)
        serializer_for_writing.is_valid(raise_exception=True)
        serializer_for_writing.save()
        return Response(data=serializer_for_writing.data, status=status.HTTP_201_CREATED)
```
Посмотрим на представление нашего API в браузере

![image](https://user-images.githubusercontent.com/60841011/141429854-7e781c68-8aaa-4367-afc6-37333679dbc4.png)

Сверху видим ответ на `GET`-запрос, в базе пока нет записи ни об одном писателе. Ниже удобная форма для отправки `POST`-запроса.

Заполним и отправим её. Результат

![image](https://user-images.githubusercontent.com/60841011/141430128-38d118fa-7e3b-45fc-9415-656f0bdd7fa0.png)

----
Итак, на примере мы разобрались, как создать API для валидации входных данных с последующей их записью в базу данных. В следующей статье мы поднимемся на один уровень абстракции вверх и рассмотим, как устроен класс `ModelSerializer`.