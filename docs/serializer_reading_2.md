## API для чтения данных (часть 2)

В прошлой части мы в общих чертах рассмотрели, как устроен REST API на DRF при работе на чтение. 
Едва ли не самый сложный для понимания этап — сериализация. 
Вооружившись исходным кодом, полностью разберем этот этап — от приема набора записей из модели до их преобразования в список словарей.

**Важный момент:** мы говорим о работе сериалайзера только на чтение, то есть когда он отдаёт пользователю информацию из базы данных (БД) сайта. О работе на запись, когда данные поступают извне и их надо сохранить в БД, расскажем в следующей статье.

Код учебного проекта, который используется в этой статье, доступен [в репозитории на Гитхабе](https://github.com/stasyao/drf_guide_part_1).

<cut />

## Как создаётся сериалайзер, работающий на чтение

Создание экземпляра сериалайзера мы описывали следующим образом:
	
```python
# capitals/views.py

        serializer_for_queryset = CapitalSerializer(
            instance=queryset,  # Передаём набор записей
            many=True # Указываем, что на вход подаётся набор записей
        )
```

Благодаря `many=True` запускается метод `many_init` класса `BaseSerializer`.

```python
class BaseSerializer(Field):
       …
    def __new__(cls, *args, **kwargs):
        if kwargs.pop('many', False):
            return cls.many_init(*args, **kwargs)
        return super().__new__(cls, *args, **kwargs)
```

Подробнее о методе `many_init`:

- При создании экземпляра сериалайзера он меняет родительский класс. Теперь родителем выступает не `CapitalSerializer`, а класс DRF для обработки наборов записей `restframework.serializers.ListSerializer`.
- Созданный экземпляр сериалайзера наделяется атрибутом `child`. В него включается дочерний сериалайзер — экземпляр класса CapitalSerializer.
   
```python
    @classmethod
    def many_init(cls, *args, **kwargs):
        ...
        child_serializer = cls(*args, **kwargs)
        list_kwargs = {
            'child': child_serializer,
        }
	  ...
        meta = getattr(cls, 'Meta', None)
        list_serializer_class = getattr(meta, 'list_serializer_class',
   						   ListSerializer)
        return list_serializer_class(*args, **list_kwargs)

```

| Экземпляр сериалайзера        | Описание                                      | К какому классу относится                                                                                  |
|-------------------------------|-----------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `serializer_for_queryset`       | Обрабатывает набор табличных записей          | **ListSerializer** — класс из модуля `restframework.serializers`                                                 |
| `serializer_for_queryset.child` | Обрабатывает каждую отдельную запись в наборе | **CapitalSerializer** — наш собственный класс, наследует от класса `Serializer` модуля `restframework.serializers` |


Помимо `many=True` мы передали значение для атрибута `instance` (инстанс). В нём — набор записей из модели.

**Важное замечание:** чтобы не запутаться и понимать, когда речь идёт о сериалайзере в целом, а когда — о дочернем сериалайзере, далее по тексту мы будем говорить «основной сериалайзер» ([в коде контроллера](https://github.com/stasyao/drf_guide_part_1/blob/master/capitals/views.py#L14) это `serializer_for_queryset`) и «дочерний сериалайзер» (атрибут `child` основного сериалайзера).

После создания основного сериалайзера мы обращаемся к его атрибуту `data`:

```python
return Response(serializer_for_queryset.data)
```

Запускается целый набор операций, каждую из которых подробно рассмотрим далее.

## Что под капотом атрибута `data` основного сериалайзера

**Важное замечание:** атрибут `data` есть и у основного, и у дочернего сериалайзеров. Поэтому, чтобы найти подходящий исходный код, нужно помнить: экземпляр основного (`serializer_for_queryset`) относится к классу `ListSerializer`.

[Исходный код](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/serializers.py#L743) атрибута `data`:

```python
class ListSerializer(BaseSerializer):
    ...
    @property
    def data(self):
        ret = super().data
        return ReturnList(ret, serializer=self)
```

Задействован атрибут `data` родительского `BaseSerializer`. [Исходный код](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/serializers.py#L232):

```python
class BaseSerializer(Field):
       … 
    @property
    def data(self):
	...
 
        if not hasattr(self, '_data'):
            if self.instance is not None and not getattr(self, '_errors', None):
                self._data = self.to_representation(self.instance)
            ...
        return self._data
```

Поскольку никакие данные ещё не сгенерированы (нет атрибута `_data`), ничего не валидируется (нет `_errors`), но есть инстанс (набор записей для сериализации), запускается метод `to_representation`, который и обрабатывает набор записей из модели.

## Как работает метод `to_represantation` основного сериалайзера

Возвращаемся в класс `ListSerializer`.

```python
class ListSerializer(BaseSerializer):
       …
    def to_representation(self, data):
        """
        List of object instances -> List of dicts of primitive datatypes.
        """
        iterable = data.all() if isinstance(data, models.Manager) else data
        return [
            self.child.to_representation(item) for item in iterable
        ]
```
 
[Исходный код](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/serializers.py#L655)

Код нехитрый:

- набор записей из модели (его передавали при создании сериалайзера в аргументе `instance`) помещается в цикл в качестве единственного аргумента `data`;
- в ходе работы цикла каждая запись из набора обрабатывается методом `to_representation` дочернего сериалайзера (`self.child.to_representation(item)`). Теперь понятно, зачем нужна конструкция «основной — дочерний сериалайзер».

Сделаем небольшую остановку:

- Чтобы обрабатывать не одну запись из БД, а набор, при создании сериалайзера нужно указать `many=True`.
- В этом случае мы получим матрёшку — основной сериалайзер с дочерним внутри.
- Задача основного сериалайзера (он относится к классу `ListSerializer`) — запустить цикл, в ходе которого дочерний обработает каждую запись и превратит ее в словарь.

## Как работает метод `to_representation` дочернего сериалайзера 

Дочерний сериалайзер — экземпляр класса `CapitalSerializer` — наследует от `restframework.serializers.Serializer`.

```python
class Serializer(BaseSerializer, metaclass=SerializerMetaclass):
…
    def to_representation(self, instance):
        """
        Object instance -> Dict of primitive datatypes.
        """
        ret = OrderedDict()
        fields = self._readable_fields

        for field in fields:
            try:
                attribute = field.get_attribute(instance)
            except SkipField:
                continue
            check_for_none = attribute.pk if isinstance(attribute, PKOnlyObject) 
     else attribute
            if check_for_none is None:
                ret[field.field_name] = None
            else:
                ret[field.field_name] = field.to_representation(attribute)
 
        return ret
```

[Исходный код](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/serializers.py#L493)

Пойдём по порядку: сначала создаётся пустой `OrderedDict`, далее идёт обращение к атрибуту `_readable_fields`.

Откуда берётся `_readable_fields`? Смотрим [исходный код](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/serializers.py#L359):

```python
class Serializer(BaseSerializer, metaclass=SerializerMetaclass):
       …
    @property
    def _readable_fields(self):
        for field in self.fields.values():
            if not field.write_only:
                yield field
```

То есть `_readable_fields` — это генератор, включающий поля дочернего сериалайзера, у которых нет атрибутa `write_only` со значением `True`. По умолчанию он `False`. Если объявить `True`, поле будет работать только на создание или обновление записи, но будет [игнорироваться при её представлении](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#write_only).

В дочернем сериалайзере все поля могут работать на чтение (представление) — ограничений `write only` не установлено. Это значит, что генератор `_readable_fields` будет включать три поля — `capital_city`, `capital_population`, `author`.

Читаем код `to_representation` далее: генератор `_readable_fields` помещается в цикл, и у каждого поля вызывается метод `get_attribute`.

Если посмотреть код `to_representation` дальше, видно, что у поля вызывается и другой метод — `to_representation`. Это не опечатка: метод `to_representation` под одним и тем же названием, но с разной логикой: 

- есть у основного сериалайзера в классе `ListSerializer`; 
- у дочернего сериалайзера в классе `Serializer`; 
- у каждого поля дочернего сериалайзера в классе соответствующего поля.

Итак, когда конкретная запись из модели попадает в сериалайзер, у каждого его поля включаются методы `get_attribute` и `to_representation`, чтобы наконец извлечь искомые данные.

## Как запись из модели обрабатывается методами полей сериалайзера

Метод `get_attribute` работает с инстансом (instance). Важно не путать этот инстанс с инстансом основного сериалайзера. Инстанс основного сериалайзера — это набор записей из модели. Инстанс дочернего сериалайзера — каждая конкретная запись. 

Вспомним [строку](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/serializers.py#L664) из кода `to_representation` основного сериалайзера:

```python
[self.child.to_representation(item) for item in iterable]
```

Этот item (отдельная запись из набора) и есть инстанс, с которым работает метод `get_attribute` конкретного поля.

```python
class Field:
       ...
    def get_attribute(self, instance):
        try:
            return get_attribute(instance, self.source_attrs)
	  ...
```
[Исходный код](https://github.com/encode/django-rest-framework/blob/master/rest_framework/fields.py#L451)

Вызывается функция `get_attribute`, описанная на уровне всего модуля `rest_framework.fields`. Функция получает на вход запись из модели и значение атрибута поля `source_attrs`. Это [список](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/fields.py#L401), который возникает в результате применения метода `split` (разделитель — точка) к строке, которая передавалась в аргументе `source` при создании поля. Если такой аргумент не передавали, то в качестве `source` будет взято [имя поля](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/fields.py#L393).

Если вспомнить, как работает строковый метод [`split`](https://docs.python.org/3/library/stdtypes.html#str.split), станет понятно, что если при указании source не применялась точечная нотация, то список всегда будет из одного элемента.

У нас есть такие поля:

```python
class CapitalSerializer(serializers.Serializer):
    capital_city = serializers.CharField(max_length=200)
    capital_population = serializers.IntegerField()
    author = serializers.CharField(source='author.username', max_length=200)
```

Получается следующая картина:

| Поле сериалайзера  | Значение атрибута source поля | Значение source_attrs  |
|--------------------|-------------------------------|------------------------|
| capital_city       | 'capital_city'                | ['capital_city']       |
| capital_population | 'capital_population'          | ['capital_population'] |
| author             | 'author.username'             | ['author', 'username'] |

Как мы уже указывали, список `source_attrs` в качестве аргумента attrs передаётся в метод [`get_attribute  rest_framework.fields`](https://github.com/encode/django-rest-framework/blob/bc075212cb05a52a2b2b2b4c909cfbd03c7ebd8e/rest_framework/fields.py#L85):

```python
def get_attribute(instance, attrs):
    for attr in attrs:
        try:
            if isinstance(instance, Mapping):
                instance = instance[attr]
            else:
                instance = getattr(instance, attr)
		...
    return instance
```

Для полей `capital_city` и `capital_population` цикл `for attr in attrs` отработает однократно и выполнит инструкцию `instance = getattr(instance, attr)`. Встроенная Python-функция [`getattr`](https://docs.python.org/3/library/functions.html#getattr) извлекает из объекта записи (instance) значение, присвоенное конкретному атрибуту (`attr`) этого объекта. 
При обработке записей из нашей таблицы рассматриваемую строку исходного кода можно представить примерно так:

```python
instance = getattr(запись_о_конкретной_столице, 'capital_city')
```

С `author.username` ситуация интереснее. До значения атрибута `username` DRF будет добираться так:

- На первой итерации инстанс — это объект записи из модели Capital. Из `source_attrs` берётся первый элемент `author`, и значение одноимённого атрибута становится новым инстансом. `author` — объект из модели User, с которой Capital связана через внешний ключ.
- На следующей итерации из `source_attrs` берётся второй элемент `username`. Значение атрибута `username` будет взято уже от нового инстанса — объекта `author`. Так мы и получаем имя автора.

Извлечённые из объекта табличной записи данные помещаются в упорядоченный словарь `ret`, но перед этим с ними работает метод `to_representation` поля сериалайзера:

```python
ret[field.field_name] = field.to_representation(attribute)
```

Задача метода `to_representation` — представить извлечённые из записи данные в определённом виде. Например, если поле сериалайзера относится к классу [`CharField`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/fields.py#L810), то извлечённые данные будут приведены к строке, а если [`IntegerField`](https://github.com/encode/django-rest-framework/blob/bc075212cb05a52a2b2b2b4c909cfbd03c7ebd8e/rest_framework/fields.py#L962) — к целому числу.

В нашем случае применение `to_representation` по сути ничего не даст. Например, из поля табличной записи `capital_city` будет извлечена строка. Метод `to_representation` поля `CharField` к извлечённой строке применит метод `str`. Очевидно, что строка останется строкой, то есть какого-то реального преобразования не произойдёт. Но если бы из поля табличной записи `IntegerField` извлекались целые числа и передавались полю класса `CharField`, то в итоге они превращались бы в строки.

При необходимости можно создать собственный класс поля сериалайзера, описать специфичную логику и для метода `get_attribute`, и для метода `to_representation`, чтобы как угодно преобразовывать поступившие на сериализацию данные. [Примеры](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#primery) есть в документации — кастомные классы `ColorField` и `ClassNameField`.

## Суммируем всё, что узнали

Преобразованный набор записей из Django-модели доступен в атрибуте `data` основного сериалайзера. При обращении к этому атрибуту задействуются следующие методы и атрибуты из-под капота DRF (разумеется, эти методы можно переопределить):

| Метод, атрибут, функция | Класс, модуль | Действие                                                                                                                                                                                                                                                                             |
|--------------------|--------|------------|
| [`data`](https://github.com/encode/django-rest-framework/blob/61e7a993bd0702d30e3049179000bc7c5f284781/rest_framework/serializers.py#L233) | `serializers.BaseSerializer` | Запускает метод `to_representation` основного сериалайзера.                                                                                                                                                                                                                                                             |
| [`to_representation`](https://github.com/encode/django-rest-framework/blob/61e7a993bd0702d30e3049179000bc7c5f284781/rest_framework/serializers.py#L655) | `serializers.ListSerializer` | Запускает цикл, в ходе которого к каждой записи из набора применяется метод `to_representation` дочернего сериалайзера.                                                                                                                                                                                                                                                             |
| [`to_representation`](https://github.com/encode/django-rest-framework/blob/61e7a993bd0702d30e3049179000bc7c5f284781/rest_framework/serializers.py#L493) | `serializers.Serializer` | Сначала создаётся экземпляр упорядоченного словаря, пока он пустой. Далее запускается цикл по всем полям сериалайзера, у которых не выставлено `write_only=True`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [`get_attribute`](https://github.com/encode/django-rest-framework/blob/61e7a993bd0702d30e3049179000bc7c5f284781/rest_framework/fields.py#L85) | `fields` (вызывается методом [`get_attribute`](https://github.com/encode/django-rest-framework/blob/61e7a993bd0702d30e3049179000bc7c5f284781/rest_framework/fields.py#L451) класса `fields.Field`)   | Функция стыкует поле сериалайзера с полем записи из БД. По умолчанию идет поиск поля, чьё название совпадает с названием поля сериалайзера. Если передавался аргумент `source`, сопоставление будет идти со значением этого аргумента. Из найденного поля табличной записи извлекается значение — текст, числа и т.д.                                                                                                                                                                                                                                                             |
| `to_representation` | `fields.КлассПоляКонкретногоТипа` | Извлечённое значение преобразуется согласно логике рассматриваемого метода. У каждого поля restframework она своя. Можно создать собственный класс поля и наделить его метод `to_representation` любой нужной логикой.  
|

В словарь заносится пара «ключ-значение»:
- ключ — название поля сериалайзера;
- значение — данные, возвращённые методом `to_representation` поля сериалайзера.

Итог: список из `OrderedDict` в количестве, равном числу переданных и сериализованных записей из модели.

_____________________