## Как работает ModelSerializer

После того, как в предыдущих разделах мы подробно разобрали работу сериалайзера на основе классов `BaseSerializer` 
и `Serializer`, мы можем перейти к классу-наследнику `ModelSerializer`. Класс модельных сериалайзеров отличается лишь тем, что у него есть несколько инструментов, позволяющих сократить код сериалайзера:
- автоматическое создание полей сериалайзера на основе данных о корреспондирующих полях модели;
- автоматическое включение в поля сериалайзера тех же валидаторов, что есть в полях модели, а также, при определенных условиях, метавалидаторов;
- заранее определенные методы `create` и `update`.

Общие же принципы работы модельного сериалайзера, как на чтение, так и на запись, идентичны тому, как работает базовый класс `Serializer`.

### 1. `ModelSerializer`: необходимый минимум <a id='1'></a>
Минимально для определения модельного сериалайзера [нужен](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L1027) лишь внутренний класс `Meta` с атрибутами: 
1. [`model`](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1032) &mdash; джанго-модель, которую будет обслуживать сериалайзер. Модель не должна быть абстрактной (подробнее об абстрактных джанго-моделях можно почитать [здесь](https://djbook.ru/rel3.0/topics/db/models.html#abstract-base-classes));
2. [Один из следующих атрибутов](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1101):  
   - `fields` &mdash; поля джанго-модели, для которых будут созданы корреспондирующие поля сериалайзера;
   - `exclude` &mdash; поля джанго-модели, для которых **не** нужно создавать поля сериалайзера (для всех остальных они будут созданы).  

### 2. Автоматически создаваемые и декларируемые поля <a id='2'></a>
#### 2.1. Автоматически создаваемые поля<a id='2-1'></a>
Поля сериалайзера, имена которых указаны во внутреннем классе `Meta` явно (через `fields`) или неявно (через `exclude`), DRF создаст самостоятельно, сопоставив с одноименными полями модели. О том, по каким правилам он это делает, расскажем ниже. Если одноименного поля модели не найдётся, будет выброшено исключение через метод [`build_unknown_field`](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1313).  
#### 2.2. Декларируемые поля<a id='2-2'></a>
Это "обычные" поля сериалайзера, которые мы описываем полностью самостоятельно вне класса `Meta`, как делали это в предыдущих статьях. Пример:
```python
class TownSerializer(serializers.ModelSerializer):
   name = serializers.CharField(allow_blank=True)

   class Meta:
      model = Town
      fields = ['id', 'writers', 'name']
```
Поле `name` &mdash; декларируемое, класс поля и его атрибуты мы задали самостоятельно.  
Поля `id` и `writers` &mdash; автоматически создаваемые.

Обратите внимание, что `name` также включено в список `fields`. Дело в том, что если присутствует атрибут `fields`, в нем [должны быть перечислены](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1124) все поля сериалайзера, включая декларируемые.

Декларируемые поля могут понадобится, к примеру, когда нам не подходит класс поля, который модельный сериалайзер подбирает автоматически. Через декларируемые поля зачастую используют вспомогательные классы `ReadOnlyField`, `HiddenField`, `SerializerMethodField`.

Если же класс поля сериалайзера устраивает, но нужна тонкая настройка его параметров (включая создание нескольких полей сериалайзера для одного поля модели), то, скорее всего, будет достаточно воспользоваться атрибутом `extra_kwargs` внутреннего класса `Meta` (о нем я расскажу в этой статье чуть позже).

#### 2.3. Что означает `fields = '__all__'`<a id='2-3'></a>
Если в качестве значения `fields` выступает строка `__all__`, то в сериалайзере будут созданы поля для обслуживания всех полей модели (кроме тех полей модели, за работу с которыми будут отвечать декларируемые поля сериалайзера). Использование `__all__` [отменяет необходимость](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1171) прописывать в `fields` декларируемые поля.


### 3. Как правильно использовать `fields` и `exclude` <a id='3'></a>
На основе исходного кода DRF можно сформулировать несколько правил:
1. `fields` и `exclude` [нельзя использовать вместе](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1094)
2. `exclude` [должен быть](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1088) либо списком, либо кортежем из названий полей модели (**даже, если поле одно**)
3. `fields` может быть задан в виде:
   - [списка либо кортежа](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1082) (**даже, если поле одно**)
   - [строки `__all__`](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L77).

Примеры модельного сериалайзера для джанго-модели `Writer`

```python
class Writer(models.Model):
    firstname = models.CharField(max_length=100...)
    lastname = models.CharField(max_length=100...)
    patronymic = models.CharField(max_length=100...)
    birth_place = models.ForeignKey(to=Town...)
    birth_date = models.DateField(...)
```
Сериалайзер, который будет обслуживать все поля модели:
```python
class WriterModelSerializer(serializers.ModelSerializer):

    class Meta:
        model = Writer
        fields = '__all__'
```
Сериалайзер, который будет обслуживать **только** поля `firstname` и `lastname`:
```python
class WriterModelSerializer(serializers.ModelSerializer):

    class Meta:
        model = Writer
        fields = ['firstname', 'lastname']
```
Сериалайзер, который будет обслуживать все поля **кроме** `firstname` и `lastname`:
```python
class WriterModelSerializer(serializers.ModelSerializer):

    class Meta:
        model = Writer
        exclude = ['firstname', 'lastname']
```


### 4. Как DRF создаёт поля для модельного сериалайзера <a id='4'></a> 
#### 4.1. Сбор информации о модели и распределение полей по группам<a id='4-1'></a>
Сначала DRF собирает детальную информацию о полях модели, для этого задействуется метод [`get_field_info`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/utils/model_meta.py#L29) из `rest_framework.utils.model_meta`. Результат &mdash; именованный кортеж `FieldResult`, в котором, в числе прочих есть, следующие элементы:
- [`relations`](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/utils/model_meta.py#L16) &mdash; словарь, объединяющий в себе поля отношений модели ("forward_relations"), а также объекты класса [RelatedManager](https://djbook.ru/rel3.0/ref/models/relations.html#django.db.models.fields.related.RelatedManager)("reverse_relations");
- `fields_and_pk` &mdash; словарь с остальными полями модели.  

Для подбора корреспондирующих полей DRF использует три метода:
- [`build_relational_field`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L1285) &mdash; для полей из `relations`;
- [`build_property_field`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L1318) &mdash; для методов и `property`-атрибутов модели
- [`build_standard_field`](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1224) &mdash; для полей из `fields_and_pk`.

Рассмотрим на примерах:
```python
class Town(models.Model):
    name = models.CharField(max_length=100, unique=True)

class Writer(models.Model):
    firstname = models.CharField(max_length=100...)
    lastname = models.CharField(max_length=100...)
    patronymic = models.CharField(max_length=100...)
    birth_place = models.ForeignKey(to=Town, to_field='name', related_name='writers'...)
    birth_date = models.DateField(...)

    def get_full_name(self):
        return f'{self.firstname} {self.patronymic} {self.lastname}'
```
Из модели `Town` DRF возьмет:
- поле `name` и поместит его в `fields_and_pk` для дальнейшей обработки методом `build_standard_field`;
- менеджер `writers`, который связывает модель `Town` с моделью `Writer` (`writers` &mdash; это значение атрибута `related_name` поля `birth_place` в связанной модели). Менеджер будет помещен в `relations` и в дальнейшем обработан методом `build_relational_field` или методом `build_nested_field` (об этом подробно расскажем чуть ниже).

Из модели `Writer` DRF возьмет:
- поля `firstname`, `lastname`, `patronymic`, `birth_date` и поместит их в `fields_and_pk` для дальнейшей обработки методом `build_standard_field`;
- поле `birth_place`, которое поместит в `relations` для дальнейшей обработки методом `build_relational_field` или методом `build_nested_field`;
- метод `get_full_name`, который после проверки `hasattr(model_class, field_name)` переадресует методу `build_property_field`.  

#### 4.2. Как DRF подбирает классы полей сериалайзера для "стандартных" полей модели<a id='4-2'></a>  
"Стандартные" поля модели &mdash; это поля, которые не относятся к полям отношений. Под капотом в классе `ModelSerializer` есть атрибут, по которому DRF решает, какой класс поля сериалайзера подобрать для конкретного поля модели. Это атрибут [`serializer_fields_mapping`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L878). При необходимости его можно дополнить или переопределить.

По дефолту классы полей модели и сериалайзера сопоставляются так:

N | Класс поля сериалайзера | Класс поля модели
-|-|-
1| [BooleanField](https://www.django-rest-framework.org/api-guide/fields/#booleanfield) | [BooleanField](https://www.djbook.ru/rel3.0/ref/models/fields.html#booleanfield), [NullBooleanField](https://www.djbook.ru/rel3.0/ref/models/fields.html#nullbooleanfield)
2| [CharField](https://www.django-rest-framework.org/api-guide/fields/#charfield) | [CharField](https://www.djbook.ru/rel3.0/ref/models/fields.html#charfield), [TextField](https://www.djbook.ru/rel3.0/ref/models/fields.html#textfield)
3| [DateField](https://www.django-rest-framework.org/api-guide/fields/#datefield) | [DateField](https://www.djbook.ru/rel3.0/ref/models/fields.html#datefield)
4| [DateTimeField](https://www.django-rest-framework.org/api-guide/fields/#datetimefield) | [DateTimeField](https://www.djbook.ru/rel3.0/ref/models/fields.html#datetimefield)
5| [DecimalField](https://www.django-rest-framework.org/api-guide/fields/#decimalfield) | [DecimalField](https://www.djbook.ru/rel3.0/ref/models/fields.html#decimalfield)
6| [DurationField](https://www.django-rest-framework.org/api-guide/fields/#durationfield) | [DurationField](https://www.djbook.ru/rel3.0/ref/models/fields.html#durationfield)
7| [EmailField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#emailfield) | [EmailField](https://www.djbook.ru/rel3.0/ref/models/fields.html#emailfield)
8| [FileField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#filefield) | [FileField](https://www.djbook.ru/rel3.0/ref/models/fields.html#filefield)
9| [FilePathField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#filepathfield) | [FilePathField](https://www.djbook.ru/rel3.0/ref/models/fields.html#filepathfield) 
10| [FloatField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#floatfield) | [FloatField](https://djbook.ru/rel3.0/ref/models/fields.html#floatfield)
11| [ImageField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#imagefield) | [ImageField](https://www.djbook.ru/rel3.0/ref/models/fields.html#imagefield)
12| [IPAddressField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#ipaddressfield) | [GenericIPAddressField](https://www.djbook.ru/rel3.0/ref/models/fields.html#genericipaddressfield)
13| [IntegerField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#integerfield) | [AutoField](https://www.djbook.ru/rel3.0/ref/models/fields.html#autofield), [BigIntegerField](https://www.djbook.ru/rel3.0/ref/models/fields.html#bigintegerfield), [IntegerField](https://www.djbook.ru/rel3.0/ref/models/fields.html#integerfield), [PositiveIntegerField](https://www.djbook.ru/rel3.0/ref/models/fields.html#positiveintegerfield), [PositiveSmallIntegerField](https://www.djbook.ru/rel3.0/ref/models/fields.html#positivesmallintegerfield), [SmallIntegerField](https://www.djbook.ru/rel3.0/ref/models/fields.html#smallintegerfield) 
14| [SlugField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#slugfield) | [SlugField](https://www.djbook.ru/rel3.0/ref/models/fields.html#slugfield)
15| [TimeField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#timefield) | [TimeField](https://www.djbook.ru/rel3.0/ref/models/fields.html#timefield)
16| [URLField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#urlfield) | [URLField](https://www.djbook.ru/rel3.0/ref/models/fields.html#urlfield)
17| [UUIDField](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#uuidfield) | [UUIDField](https://www.djbook.ru/rel3.0/ref/models/fields.html#uuidfield)

Вне `serializer_fields_mapping` [описана логика](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L906) сопоставления полей `JSONField`, а также специфичных для `PostgreSQL` [полей](https://djbook.ru/rel3.0/ref/contrib/postgres/fields.html#postgresql-specific-model-fields).

#### 4.3. Как DRF подбирает классы для полей отношений <a id='4-3'></a>
Для `ForeignKey` полей модели в модельном сериалайзере [могут создаваться](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1285) поля одного из двух классов:
- [`SlugRelatedField`](https://www.django-rest-framework.org/api-guide/relations/#slugrelatedfield), если в поле модели задан атрибут [`to_field`](https://djbook.ru/rel3.0/ref/models/fields.html?highlight=to_field#django.db.models.ForeignKey.to_field);
- [`PrimaryKeyRelatedField`](https://www.django-rest-framework.org/api-guide/relations/#primarykeyrelatedfield) в иных случаях.

Для `ManyToMany` полей модели в модельном сериалайзере создаётся поле класса [`PrimaryKeyRelatedField`](https://www.django-rest-framework.org/api-guide/relations/#primarykeyrelatedfield).  

Для обратных связей (объектов `RelatedManager`) создаётся поле класса [`PrimaryKeyRelatedField`](https://www.django-rest-framework.org/api-guide/relations/#primarykeyrelatedfield).

> **Важный момент**: названия автоматически создаваемых полей серилайзера для обратных связей нужно явно указывать в атрибуте `fields` класса `Meta`. Строка `__all__` [не включает](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1646) в себя названия объектов `RelatedManager` модели.

Примеры.
```py
class Town(models.Model):
    name = models.CharField(max_length=100, unique=True)

class Writer(models.Model):
    # другие поля опускаем для краткости
    birth_place = models.ForeignKey(to=Town, to_field='name', related_name='writers',...)
   
class TownSerializer(serializers.ModelSerializer):
   class Meta:
      model = Town
      fields = '__all__' # в сериалайзере будет создано 2 поля: `id` и `name`
#ИЛИ  fields = ['id', 'name', 'writers'] - будет дополнительно создано поле `writers` 
# для доступа к записям в связанной модели

class WriterSerializer(serialziers.ModelSerializer):
   class Meta:
      model = Writer
      fields = '__all__' # в сериалайзере будут все поля модели, включая `birth_place`,
      # т.к. `forward_relations` включаются в `__all__`. 
      # для поля `birth_place` будет подобран класс `SlugRelatedField`, поскольку
      # в корреспондирующем поле модели установлен атрибут `to_field`.
```
#### 4.4. Как DRF работает с методами модели и проперти <a id='4-4'></a>
В этом случае ничего особенного не происходит: DRF [создаёт](https://github.com/encode/django-rest-framework/blob/98e56e0327596db352b35fa3b3dc8355dc9bd030/rest_framework/serializers.py#L1295) `ReadOnlyField`, которое, как видно по названию, участвует только при работе сериалайзера на чтение, и без какой-либо дополнительной валидации возвращает значение из метода или проперти модели.

### 5. `extra_kwargs`: тонкая настройка автоматически создаваемых полей <a id='5'></a>

Атрибут `extra_kwargs` определяют во внутреннем классе `Meta`. Это словарь, ключами которого выступают поля из `fields` (или поля модели, не перечисленные в `exclude`). Значением для каждого ключа служит словарь с атрибутами, которыми нужно дополнить то или иное поле сериалайзера.

Допустим, мы хотим, чтобы сериалайзер для модели `Town` работал так:
- на чтение &mdash; возвращал названия городов из столбца `name` не в виде `{'name': 'название_города'}`, а в виде `{'town': 'название_города'}`
- на запись &mdash; получал данные для столбца `name` в виде `{'name': 'название_города'}`.

По сути, нам нужно, чтобы одно и то же поле модели обслуживали поля сериалайзера с разными названиями (в зависимости от того, в какую сторону работает сериалайзер).

Вооружившись знаниями из предыдущих статей о том, как работает сериалайзер на чтение и на запись (об аргументе `source`, о writable- и readable-полях), можно прийти к такому решению:
```python
class Town(models.Model):
    name = models.CharField(max_length=100, unique=True)

class TownModelSerializer(serializers.ModelSerializer):

    class Meta:
        model = Town
        fields = ['town', 'name']
        extra_kwargs = {
            'town': {'source': 'name', 'read_only': True},
            'name': {'write_only': True}
        }
```
`TownModelSerializer(instance=Town.objects.first()).data` вернет `{'town': 'Вологда'}`  
`TownModelSerializer(data={'name': 'Анапа'})` после валидации вернет в `validated_data` словарь `{'name': 'Анапа'}`.  

Разберем, какую донастройку модельного сериалайзера мы провели:
- указали, что одноименное с полем модели поле `name` работает только на запись (в данных, получаемых из базы, ключа `'name'` не будет);
- добавили сериалайзеру ещё одно поле под названием `'town'` и установили, что оно:
  - работает только на чтение, т.е. только при получении словаря с данными о записи в модели `Town`, там будет ключ `'town'`
  - источником (`source`) значения для этого ключа будет атрибут (поле) `name` записи в модели `Town` 

Отмечу, что `read_only_fields` [можно задать](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1380) и в качестве отдельного атрибута внутри `Meta` (обязательно в виде списка или кортежа).

Пример показывает, насколько гибким может быть сериалайзер, и что не следует ограничивать осмысление DRF схемой "количество полей сериалайзера == количество полей модели". С одним и тем же полем модели может работать несколько полей сериалайзера и даже несколько разных сериалайзеров.  

**Важный момент**: некоторые атрибуты полей сочетать не имеет смысла, а иногда и вовсе может привести к появлению исключения. В классе модельных сериалайзеров за правильным сочетанием атрибутов полей следит метод [`include_extra_kwargs`](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1345).  

Не нужно устанавливать:
- атрибуты `required`, `default`, `allow_blank`, `min_length`, `max_length`, `min_value`, `max_value`, `validators`, `queryset` с атрибутом `read_only=True`. DRF обрежет эти атрибуты, оставив только `read_only`;
- атрибут `required` с атрибутом `default`, в котором есть какое-либо truthy-значение. DRF удалит `required`, оставив `default`.

### 6. Работа с вложенными объектами <a id='6'></a>

#### 6.1. Атрибут `depth` <a id='6-1'></a>
Рассмотрим следующий пример. Создадим сериалайзер для работы с записями из модели `Town`, с которой через внешний ключ связана модель `Writer` (`related_name` &mdash; `writers`).  
```python
class TownSerializer(serializers.ModelSerializer):
   class Meta:
      model = Town
      fields = ['id', 'name', 'writers']
      
s = TownSerializer(instance=Town.objects.first())
print(s.data)
-------------
{'id': 1, 'name': 'Вологда', 'writers': [6, 7]}
```
По ключу `writers` мы получили список из айдишников родившихся в Вологде писателей.  
Если мы хотим раскрыть информацию о вложенных объектах, поможет атрибут `depth` класса `Meta`. Устанавливаем его в значении 1 и сериалайзер раскрывает содержимое объектов из списка `writers`.  
```py
class TownSerializer(serializers.ModelSerializer):
   class Meta:
      model = Town
      depth = 1
      fields = ['id', 'name', 'writers']
      
s = TownSerializer(instance=Town.objects.first())
print(s.data)
-------------
{
   'id': 1,
   'name': 'Вологда',
   'writers': [
                  {'id': 6, 'firstname': 'Варлам', 'lastname': 'Шаламов', ...},
                  {'id': 7, 'firstname': 'Константин', 'lastname': 'Батюшков', ...}
              ]
}
```
Если установлен атрибут `depth=1` включается метод [`build_nested_field`](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1214) и поле сериалайзера, которое отвечает за поле отношения модели (или объект `RelatedManager`), становится объектом класса `NestedSerializer`. Его [код](https://github.com/encode/django-rest-framework/blob/060a3b632f6f6ff2f84235d1be5da55020c40ff3/rest_framework/serializers.py#L1307) очень прост:
```python
class NestedSerializer(ModelSerializer):
   class Meta:
       model = relation_info.related_model
       depth = nested_depth - 1
       fields = '__all__'
```
Фактически объект из связанной модели обрабатывает сериалайзер внутри сериалайзера и выдаёт словарь со всеми полями этого объекта (`fields = '__all__'`). 

Вполне возможно, что не нужны все поля связанных объектов. Выход: явно указать, какой сериалайзер должен обслуживать прямые или обратные связи модели.  

#### 6.2. Сериалайзер в качестве поля <a id='6-2'></a>
Для более гибкой работы с вложенными объектами мы можем передавать их сериалайзеру внутри сериалайзера самостоятельно, а не через объявление атрибута `depth` в классе `Meta`.  

Для этого нужно сделать следующее:
- поле, которое будет работать с вложенными объектами, нужно объявить явно в `declared fields`, иными словами, как самостоятельный атрибут сериалайзера.

Развивая пример из предыдушего раздела, нам нужно в декларируемые поля вытащить поле `writers` (не забываем, что его нужно всё равно упомянуть в `fields` в `Meta`).  

```py
class TownSerializer(serializers.ModelSerializer):
    # область декларируемых полей
    writers = ...

    class Meta:
       model = Town
       fields = ['id', 'name', 'writers']
```
- далее нужно создать (или взять имеющийся) сериалайзер, который будет обрабатывать вложенные объекты.  

В нашем примере поле `writers` будет иметь дело с объектами из модели `Writer`. Создадим для них сериалайзер, который будет отдавать только имя, фамилию, отчество автора и дату его рождения (иными словами, мы исключим поля `id` и `birth_place`).  

Сериалайзер будет выглядеть так:
```py
class WriterSerializer(serializers.ModelSerializer):

    class Meta:
        model = Writer
        exclude = ('id', 'birth_place')
```

- остается передать созданный сериалайзер в качестве поля в `TownSerializer`  

```py
class TownSerializer(serializers.ModelSerializer):
   writers = WriterSerializer(many=True)

   class Meta:
      model = Town
      fields = ['id', 'name', 'writers']
```
Заметьте: мы используем `many=True`, потому что `writers` &mdash; это всегда список айдишников авторов (связь `один-ко-многим`).  

Теперь, когда `TownSerializer` в числе прочих данных получит из записи в БД список `writers`, он передаст его вложенному сериалайзеру `WriterSerializer`, который, в свою очередь, обработает каждый объект в списке и вернет список словарей с интересующей нас информацией об авторах, родившихся в конкретном городе.  

### 7. Особенности валидации в `ModelSerializer` <a id='7'></a>

#### 1. Метавалидаторы `unique_together`, `unique_for_date`, `unique_for_month`, `unique_for_year` <a id='7-1'></a> 
При наличии таких валидаторов в модели, DRF автоматически перенесет их в сериалайзер. За это отвечает метод [`get_validators`](https://github.com/encode/django-rest-framework/blob/0d5250cffada2ac250e24407953d4862d04d3dae/rest_framework/serializers.py#L1510). Но здесь есть два подводных камня:
1. Никакого автоматического переноса не будет, если во внутреннем классе Meta задан атрибут `validators`. Иными словами, нельзя полагаться на то, что можно указать в `validators`, к примеру, кастомный метавалидатор, а к нему автоматом подтянутся рассматриваемые метавалидаторы из модели. Нет. Если решили использовать атрибут `validators`, значит, нужно указывать в нем все метавалидаторы, включая те, что уже есть в модели.
2. `unique_together` в настоящее время [не рекомендован](https://djbook.ru/rel3.0/ref/models/options.html?highlight=unique_together#unique-together) для использования в джанго-моделях. Вместо него документация советует использовать опцию `constraints` и класс [`UniqueConstraint`](https://djbook.ru/rel3.0/ref/models/constraints.html#uniqueconstraint). Если вы последовали рекомендации, то соответствующий валидатор нужно перенести в сериалайзер вручную, DRF автоматически этого не сделает.   

#### 2. Валидаторы на уровне поля <a id='7-2'></a>
Валидаторы, как из параметра `validators`, так и из специальных параметров, за которыми стоят различные виды валидаторов (например, аргументы `unique`, `max_value`, `min_value` и т.д.), автоматически переносятся в поля сериалайзера. За это отвечает метод `get_field_kwargs` из `restframework.utils.field_mapping`.

**Важный момент**: сказанное относится только к автоматически создаваемым полям. Для декларируемых полей все валидаторы нужно указывать вручную.