## API для чтения данных: общая схема

Разберёмся, как сделать REST API на базе Django Rest Framework, чтобы получить по GET-запросу набор записей из базы данных (БД). Иными словами, рассмотрим, как DRF работает на чтение (о том, как с помощью него создавать, изменять и удалять записи в БД, поговорим в отдельной статье). 

Общую схему решения этой задачи мы рассмотрим в первой части статьи. Вторая будет посвящена детальному разбору процесса сериализации данных.

<cut />

Несколько вводных замечаний:
- Учебный проект, на основе которого даны все примеры в статье, можно найти [в репозитории на Гитхабе](https://github.com/stasyao/drf_guide_part_1).
- Стиль и объём изложения рассчитаны на тех, кто не знаком с DRF и только начинает свой путь в разработке. 
- Предполагается, что читатель в общих чертах уже знаком с Django и знает основы ООП на Python.

Надеюсь, статья станет хорошим подспорьем изучения DRF и работы с его документацией, прояснит процесс сериализации данных и даст уверенность, что любая магия исчезает, стоит только покопаться под капотом конкретной библиотеки.

## API для сайта на Django: общая схема

### Задача

На локальном сервере работает одностраничный сайт на Django. На единственной странице сайта по адресу `http://localhost:8000` пользователи видят информацию о четырёх североевропейских столицах. Информация попадает на страницу из подключённой к сайту базы данных, в которой есть модель Capital с пятью полями:

| id | country | capital_city | capital_population | author (FK) |
|----|---------|--------------|--------------------|-------------|
| 1  | Norway  | Oslo         | 693500             | 1           |
| 2  | Sweden  | Stockholm    | 961600             | 1           |
| 3  | Finland | Helsinki     | 655300             | 1           |
| 4  | Iceland | Reykjavik    | 128800             | 1           |

Поле `author` через внешний ключ (foreign key) связано [с моделью User](https://github.com/stasyao/drf_guide_part_1/blob/7904f82905a3d5c561a644a2aa1fc313baab9fcd/capitals/models.py#L6), в которой есть вся информация о пользователе с конкретным id.

**Мы хотим получить информацию из базы данных, не открывая сайт в браузере, а сделав запрос из другого Python-приложения.**

В каком виде нужно получить информацию:

- Набор информации должен быть списком из Python-словарей: ключ — название поля записи в таблице Capital, значение — содержимое конкретного поля.
- Названия стран нас не интересуют — нам нужны названия столиц, численность населения, а также имя сотрудника, который внёс запись в базу. Имя получаем через id автора, указанный в поле `author`.
- Для передачи по сети полученные из БД данные должны быть конвертированы в json-формат.

Таким образом, каждую запись, которая при извлечении из базы данных является Python-объектом, принимающее приложение после декодирования json-строки должно получать в виде словаря:

```
{
  'capital_city': 'Oslo',
  'capital_population': 693500,
  'author': 'test_user'
}
```

В этом и состоит одно из назначений API — дать возможность различным приложениям доставать из БД сайта информацию в виде структуры данных, которую дальше можно обрабатывать.

### Решаем задачу с помощью Django Rest Framework 

Задача решается в два шага:

- Сложный объект (набор записей из Django-модели) нужно превратить в более простую структуру, в нашем случае в список словарей. Понадобится [сериалайзер](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/serializers#cerializatory).
- Сериализованные данные для дальнейшей передачи по сети нужно перевести (отрендерить) [в json-формат](https://www.json.org/json-ru.html) — универсальный текстовый формат передачи данных, не зависящий от языка реализации. Понадобится рендер.

Небольшое отступление о json. Базовые структуры данных на python кодируются в json и [декодируются](https://docs.python.org/3/library/json.html#json.JSONEncoder) обратно следующим образом:

| Python                                 | JSON   | Пример Python                                     | Пример JSON              |
|----------------------------------------|--------|---------------------------------------------------|--------------------------|
| dict                                   | object | {'ключ': 'значение'}                              | {"ключ": "значение"}     |
| list, tuple                            | array  | ['элемент1', 'элемент2'], ('элемент1', 'элемент2') | ["элемент1", "элемент2"] |
| str                                    | string | 'элемент1'                                        | "элемент1"               |
| int, float, int- & float-derived Enums | number | 5, 4.2                                            | 5, 4.2                   |
| True                                   | true   | True                                              | true                     |
| False                                  | false  | False                                             | false                    |
| None                                   | null   | None                                              | null                     |


### Создаём сериалайзер

Каждая запись в таблице Capital — объект. И как у любого объекта, у записи есть свои атрибуты. Изучим их на примере первой записи о столице Норвегии, воспользовавшись атрибутом `__dict__`. Нам доступен [словарь](https://docs.python.org/3/library/stdtypes.html#object.__dict__), который хранит информацию о динамических (writable) атрибутах объекта:

```python

Capital.objects.first().__dict__
 
{
    '_state': <django.db.models.base.ModelState object at 0x00000126F2DB0BB0>,
    'id': 1,
    'country': 'Norway',
    'capital_city': 'Oslo',
    'capital_population': 693500, 
    'author_id': 1
}
```

Каждое поле модели Capital — атрибут объекта конкретной записи. При этом [поле `author`](https://github.com/stasyao/drf_guide_part_1/blob/e20e8e8dc418caea3e5264ccd52228995a1667b7/capitals/models.py#L10), которое через [внешний ключ](https://www.djbook.ru/rel3.0/ref/models/fields.html#foreignkey) связано с моделью User и содержит id объектов из неё, в атрибуте записи и в БД получает [приставку](https://www.djbook.ru/rel3.0/ref/models/fields.html#database-representation) `_id`.

Сериалайзер поможет достать данные из нужных атрибутов (полей) записи и сформировать упорядоченный python-словарь — объект класса `OrderedDict`. Отмечу, что в Python с версии 3.7 и «обычные» словари [стали сохранять](https://docs.python.org/3.7/whatsnew/3.7.html#summary-release-highlights) порядок вставки пар «ключ — значение».

Для сериалайзера нужно описать поля: каждое поле будет отвечать за извлечение и представление данных из корреспондирующего поля табличной записи.

**Важный момент:** здесь мы рассматриваем сериалайзер на основе базового класса `Serializer`, чтобы лучше понять принципы его работы. На более высоком уровне абстракции есть [класс `ModelSerializer`](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/serializers#modelserializer), который позволяет частично уйти от ручного создания полей. В этой статье он не рассматривается.

Нас интересуют данные, которые есть в трёх полях каждой табличной записи:

- поле `capital_city`,
- поле `capital_population`,
- поле `author`.

Значит, в сериалайзере должно быть тоже три атрибута-поля.

При создании поля сериалайзера нужно определиться с названием поля и его типом. Назвать поля сериалайзера можно как угодно: именно эти названия будут ключами в словаре, в который сериалайзер преобразует запись из таблицы. 

Вот примеры трёх вариантов названий полей сериалайзера:

![](https://habrastorage.org/webt/8q/py/ix/8qpyixotc6_titswyvknxevt4uo.png)

Но как сериалайзер понимает, в каком порядке стыковать собственные поля с полями табличной записи? Например, если поле сериалайзера условно называется `a`, то как он определяет, что его нужно состыковать с полем записи `capital_city`?

Логика такая:

- При создании поля сериалайзера можно передать аргумент `source` и в качестве значения указать название поля табличной записи, данные из которого будут пропускаться через поле сериалайзера. Продолжая пример, если поле сериалайзера названо `a` и при этом указано `source='capital_city'`, то из табличной записи будут извлекаться данные атрибута (поля) `capital_city`. Именно поэтому на выходе сформируется пара `"a": "Oslo"`.
- Через точечную нотацию в аргументе source можно передать значение объекта из записи, с которой сериализуемая запись связана через внешний ключ. Так можно достать имя автора из таблицы пользователей, указав `source='author.username'`.
- Если аргумент source не передан, то сериалайзер будет искать в табличной записи атрибут с тем же названием, что и название поля сериалайзера. Если не найдёт, появится [ошибка `AttributeError`](https://docs.python.org/3/library/exceptions.html#AttributeError).
- Если передать в аргументе `source` значение, которое совпадает с названием поля сериалайзера, возникнет [ошибка `AssertionError`](https://docs.python.org/3/library/exceptions.html#AssertionError), a DRF предупредит: [такое дублирование избыточно](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/fields.py#L375).

Теперь нужно выбрать тип поля сериалайзера. Его нужно соотнести с тем, какие данные извлекаются из корреспондирующего поля табличной записи. Дело в том, что у каждого поля сериалайзера есть собственный метод `to_representation`. Как следует из названия, задача метода — представить извлечённые из записи данные в определённом виде.

Например, есть поле `serializers.IntegerField`. Посмотрим на его [метод `to_representation`](https://github.com/encode/django-rest-framework/blob/master/rest_framework/fields.py#L962):

```python
class IntegerField(Field):
	. . .
    def to_representation(self, value):
        return int(value)
```

Очевидно, этот тип поля сериалайзера нельзя выбирать для данных из табличной записи о названии столицы: `int('Осло')` вызовет [ValueError](https://docs.python.org/3/library/exceptions.html#ValueError). А вот для данных о численности населения — самое то.

Выберем следующие типы полей сериалайзера:

| Название поля в таблице (модели) | Тип поля в таблице (модели) | Тип корреспондирующего поля сериалайзера |
|----------------------------------|-----------------------------|------------------------------------------|
| capital_city                     | models.CharField            | serializers.CharField                    |
| capital_population               | models.IntegerField         | serializers.IntegerField                 |
| author                           | models.ForeignKey            | serializers.CharField                    |

О соотношении полей сериалайзера и полей Django-моделей можно прочитать [в документации DRF](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#logicheskie-polya).

Код сериалайзера разместим в том же приложении, где находится Django-модель, под именем [serializers.py](https://github.com/stasyao/drf_guide_part_1/blob/master/capitals/serializers.py):
 
```python
# capitals/serializers.py
from rest_framework import serializers
 
class CapitalSerializer(serializers.Serializer):
    capital_city = serializers.CharField(max_length=200)
    capital_population = serializers.IntegerField()
    author = serializers.CharField(source='author.username', max_length=200)
```

В поле `CharField` указан необязательный параметр `max_length`, благодаря которому задаётся максимально допустимая длина передаваемого значения. О других параметрах поля написано [в документации](https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#charfield).

Для полей сериалайзера `capital_city` и `capital_population` мы не передаём аргумент `source` — названия поля сериалайзера и корреспондирующего поля табличной записи совпадают. Для поля `author`, наоборот, нужен аргумент `source`. В поле `author` модели Capital есть только id автора, а нам нужен его username. За этим значением мы идём в таблицу с данными о пользователях, с которой поле `author` связано по внешнему ключу. Используем точечную нотацию `author.username`.

Пропущенный через сериалайзер набор табличных записей доступен в атрибуте сериалайзера `data`. Посмотрим на содержимое этого атрибута, создав тестовый вариант сериалайзера.

### Сериалайзер в действии

Обратимся к файлу [`serializer_example_1.py`](https://github.com/stasyao/drf_guide_part_1/blob/master/serializer_example_1.py). Он имитирует работу сериалайзера без необходимости запускать сервер и делать запрос к сайту. После клонирования учебного проекта и установки зависимостей ([шаги 1—6 из ридми](https://github.com/stasyao/drf_guide_part_1/blob/master/README.md)) достаточно запустить файл как обычный Python-скрипт и посмотреть в консоли результат его работы.

В `serializer_example_1.py` созданы классы с данными об авторах и о столицах для записей в таблицах:

```python
class User:
    def __init__(self, username):
        self.username = username

class Capital:
    def __init__(self, country, capital_city, capital_population, user: User):
        self.country = country
        self.capital_city = capital_city
        self.capital_population = capital_population
        self.author = user
```

Созданы объекты соответствующих записей:

```python
author_obj = User('test_user')
capital_1 = Capital('Norway', 'Oslo', 693500, author_obj)
. . . 
```
 
Объединены записи в список по подобию кверисета из Django-модели:

```python
queryset = [capital_1, capital_2, capital_3, capital_4]
```

Объявлен класс сериалайзера: код идентичен тому, который был приведён выше для `class CapitalSerializer(serializers.Serializer)`. Затем создали его экземпляр:

```python
serializer_obj = CapitalSerializer(instance=queryset, many=True)
```

При создании мы передали сериалайзеру набор записей, которые нужно преобразовать. Они передаются в аргументе `instance`.

Кроме того, мы указали аргумент `many` со значением `True`. Дело в том, что логика работы сериалайзера с одной записью и с набором записей разная. Указывая `many=True`, мы включаем логику обработки набора записей. В чём она заключается, расскажу во второй части статьи при детальном разборе работы сериалайзера.

Выведем в консоль содержимое атрибута `data` сериалайзера:

```python
# serializer_obj.data
[
    OrderedDict([('capital_city', 'Oslo'), ('capital_population', 693500),
                 ('author', 'test_user')]),
    OrderedDict([('capital_city', 'Stockholm'), ('capital_population', 961600), 
                 ('author', 'test_user')]),
    ...
]
```

Каждая запись из набора превратилась в упорядоченный словарь класса `OrderedDict`. Он находится в Python-модуле `collections`. Поэтому, если взглянуть на строки импорта [в исходном коде](https://github.com/encode/django-rest-framework/blob/master/rest_framework/serializers.py#L16) `restframework.serializers`, можно увидеть: 

```python
from collections import OrderedDict, defaultdict
```

В каждом `OrderedDict` содержится информация только из тех полей табличных записей, которые были состыкованы с полями сериалайзера. Данных о содержимом поля `country` нет — сериалайзер не настроен доставать эту информацию, потому что мы не создавали корреспондирующего поля в сериалайзере.

### Отображаем (рендерим) информацию в формате json

Нам понадобится рендер — объект класса [`JSONRenderer`](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/renderers.py#L53). В файле [`serializer_example_2.py`](https://github.com/stasyao/drf_guide_part_1/blob/master/serializer_example_2.py) мы дополнили импорт — помимо модуля сериалайзеров из `restframework` мы импортировали модуль рендеров.

Далее необходимо создать экземпляр рендера нужного типа и вызвать у него метод `render`:

```python
json_render_for_our_data = renderers.JSONRenderer()
data_in_json = json_render_for_our_data.render(serializer_obj.data)
```

В результате мы увидим байтовую строку с массивом json-объектов:

```json
b'[{"capital_city":"Oslo","capital_population":693500,"author":"test_user"},{"capital_city":"Stockholm","capital_population":961600,"author":"test_user"},...]'
```

Эта байтовая строка и будет передаваться по сети в атрибуте ответа `content`, а принимающее приложение будет её декодировать в список из Python-словарей и вытаскивать нужную информацию из каждого.

## Что нужно ещё

Итак, мы испытали сериалайзер и посмотрели, как пропущенный через него набор табличных записей был преобразован в json-формат.

Чтобы сайт начал отдавать сериализованные данные, остаётся описать контроллер (view) и указать url-маршрут — эндпоинт, при обращении к которому сайт будет отдавать данные о столичных городах.

### Контроллер

Во [`views.py`](https://github.com/stasyao/drf_guide_part_1/blob/master/capitals/views.py) создадим класс контроллера. Нам понадобятся следующие инструменты DRF:

- [класс `APIView`](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/views.py#L104), который служит каркасом для контроллера;
- [класс `Response`](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/response.py#L14), с помощью которого будет создан объект ответа на запрос. Похожая схема есть в «классическом» Django, где в ответ на `HTTPRequest` [должен возвращаться](https://docs.djangoproject.com/en/3.1/ref/request-response/#quick-overview) `HTTPResponse`.

Внутри контроллера описываем один метод — get. Почему он называется именно так?

Логика класса-родителя `APIView`, а значит, и класса контроллера, такова: в контроллере запускается метод, чьё имя совпадает [с именем метода поступившего http-запроса](https://github.com/encode/django-rest-framework/blob/3875d3284e73ed4d8e36c07d9b70c1b22c9d5998/rest_framework/views.py#L500) в нижнем регистре. Ровно так же работает [родительский View-класс в Django](https://github.com/django/django/blob/main/django/views/generic/base.py#L97).

Пример: если поступил GET-запрос, то будет задействован метод get контроллера.

В методе `get` опишем ту же логику, что и в файле с пробным запуском сериалайзера:

1. Подготовить набор записей.
2. Создать экземпляр сериалайзера, который может обрабатывать не отдельную запись, а их набор (`many=True`).
3. Отрендерить в json-формат данные, полученные от сериалайзера.

```python
# capitals/views.py
from rest_framework.response import Response
from rest_framework.views import APIView
 
from .models import Capital
from .serializers import CapitalSerializer


class GetCapitalInfoView(APIView):
    def get(self, request):
        # Получаем набор всех записей из таблицы Capital
        queryset = Capital.objects.all()
        # Сериализуем извлечённый набор записей
        serializer_for_queryset = CapitalSerializer(
            instance=queryset, # Передаём набор записей
            many=True # Указываем, что на вход подаётся именно набор записей
        )
        return Response(serializer_for_queryset.data)
```

В отличие от файла `serializer_example_2.py`, где мы явно прописывали json-рендер и вызывали у него метод `render`, в коде контроллера ничего такого нет. Но рендер всё равно отработает: его работа описана под капотом внутри класса-родителя `APIView`.

После того как отработал метод get, работа контроллера выглядит так:

1. Объект ответа, который вернул метод get (`return Response({'capitals': serializer_for_queryset.data}`), передаётся в метод [`finalize_response`](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/views.py#L418) родительского класса `APIView`.
2. В методе `finalize_response` объекту ответа добавляются атрибуты:
  - `accepted_renderer` — им как раз выступает объект JSONRenderer,
  - `accepted_media_type` — 'application/json',
  - `context`.

Благодаря этим атрибутам формируется [`rendered_content`](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/response.py#L50): у экземпляра JSONRenderer срабатывает метод `render`, который возвращает байтовую строку с данными [в json-формат](https://github.com/encode/django-rest-framework/blob/71e6c30034a1dd35a39ca74f86c371713e762c79/rest_framework/renderers.py#L85). Она помещается в атрибут ответа `content`.

### Маршрут (эндпоинт)

Здесь та же схема действий, как в классическом Django. Подключаем маршруты приложения capitals:

```python
# config/urls.py
from django.urls import include, path
 
urlpatterns = [
    path('', include('capitals.urls')),
]
```

Прописываем сам маршрут в приложении `capitals` и связываем маршрут с контроллером:

```python
# capitals/urls.py
from django.urls import path
 
from . import views
 
urlpatterns = [
    path('api/capitals/', views.GetCapitalInfoView.as_view()),
]
```

### API в действии

Чтобы посмотреть, как работает API, можно:

1. Подготовить Python-скрипт, который будет отправлять запрос на адрес `http://localhost:8000/api/capitals/` и что-то делать с полученным контентом.
2. Запустить локальный сервер, на котором работает сайт — `python manage.py runserver`.
3. Запустить в терминале Python-скрипт.

Первый шаг уже сделан: в корне учебного проекта есть файл [`get_info_from_our_site.py`](https://github.com/stasyao/drf_guide_part_1/blob/master/get_info_from_our_site.py). Этот скрипт делает запрос к `http://localhost:8000/api/capitals/`, декодирует полученный json-ответ и записывает информацию о столицах и их населении в текстовый файл.

Осталось выполнить шаги 2 и 3.

Если всё отработало штатно, в корневой директории проекта появится файл `capitals.txt` со следующим содержимым:

```
The population of Oslo is 693500, author - test_user
The population of Stockholm is 961600, author - test_user
The population of Helsinki is 655300, author - test_user
The population of Reykjavik is 128800, author - test_user
```

Несмотря на то, что пример наивный, он показывает главное: как мы научили
веб-приложение отдавать информацию из базы данных в ответ на запрос, который поступает не от человека через браузер, а от другого приложения. И далее — как это приложение использует полученную информацию.

## Browsable API — удобный инструмент для тестирования API на DRF

Django Rest Framework позволяет посмотреть в браузере, какую информацию будет отдавать API при обращении к конкретному маршруту (эндпоинту). Достаточно ввести маршрут в адресную строку, и откроется страница с данными о запросе и результате его выполнения. За такое отображение отвечает [BrowsableAPIRenderer](https://www.django-rest-framework.org/api-guide/renderers/#browsableapirenderer).

![](https://habrastorage.org/webt/kq/1m/nu/kq1mnupq7tax-er6b67upa29yqw.png)
