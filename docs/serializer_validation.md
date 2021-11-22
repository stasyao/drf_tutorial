<h2>API для записи и обновления данных (часть 1)</h2>

В этой статье расскажу, как с помощью сериалайзера проверить поступившие данные для записи в БД. Валидация в DRF состоит из множества этапов с массой нюансов. Если при чтении покажется, что деталей очень много и картинка в голове начинает плыть, в конце статьи есть таблица с кратким описанием последовательности всех проверок.

<cut />

DRF позволяет не только извлекать и передавать записи из БД сторонним приложениям, но и принимать от них данные для использования на вашем веб-сайте. Например, чтобы создать новую запись в БД или обновить существующую. Когда REST API принимает данные извне, происходит их десериализация ― восстановление Python-объекта из последовательности байтов, пришедших по сети.

Процесс создания или обновления одной записи в БД с помощью DRF включает следующие шаги:

1. Объявляем класс сериалайзера, через который будут проходить входные данные. Один и тот же класс сериалайзера может работать одновременно и на запись, и на чтение.

2. Стороннее приложение отправляет POST-, PUT- или PATCH-запрос к эндпоинту API.

3. Контроллер (view), отвечающий за эндпоинт, извлекает <a href="https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/requests#data">из атрибута <i>data </i>объекта <i>request</i></a> данные для записи.

4. В контроллере создаём экземпляр сериалайзера, которому передаём поступившие данные, а также при необходимости запись из БД, которую предстоит обновить, и другие аргументы.

5. Вызываем метод <i>is_valid</i> сериалайзера. Он валидирует данные, а также позволяет скорректировать и расширить их. При валидации используются как инструменты из-под капота, так и наши собственные методы.

6. При успешной валидации вызываем метод <i>save</i> сериалайзера, благодаря которому в БД создаётся новая запись или обновляется существующая.

Одной статьи для подробного разбора, увы, не хватит, поэтому я снова разделил её на две части. В первой части поговорим о создании и работе сериалайзера на запись — это шаги 1, 3 и 5. В следующей статье рассмотрим остальные шаги и проиллюстрируем работу API на примерах.

<b>Важно:</b> как и в случае с сериалайзером на чтение, рассмотрим работу сериалайзера на запись на основе класса <i>serializers.Serializer</i>. Об особенностях работы дочернего класса <i>ModelSerializer</i> поговорим в отдельной статье.

<h2>Объявляем класс сериалайзера на запись</h2>
Чтобы сериалайзер мог работать на запись, у него должны быть:

<ul>
	<li>поля, которые могут работать на запись, — поля с атрибутом <i>read_only=True</i> будут игнорироваться;</li>

	<li>методы <i>create</i> (если хотим сохранить в БД новую запись) и <i>update</i> (если хотим обновить существующую запись).</li>
</ul>

Напомню, что один и тот же класс сериалайзера может работать одновременно и на запись, и на чтение. Можно сделать и разные сериалайзеры под разные запросы.

Попробую пояснить на примере из <a href="https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/serializers#proverka-na-urovne-polya">документации</a>:

<source lang="python">from rest_framework import serializers
 
class BlogPostSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=100)
    content = serializers.CharField(source='text')</source>

Сериалайзер может работать на чтение, преобразовывая каждую переданную из БД запись, у которой есть атрибуты <i>title</i> и <i>text</i>, в словарь <i>{'title': 'значение', 'content': 'значение'}</i>. Если атрибутов <i>title</i> или <i>text</i> у записи не окажется, возникнет исключение.

Этот же сериалайзер может работать на запись — только нужно дописать методы <i>create</i> и <i>update</i>. Тогда на вход он будет ожидать словарь <i>{'title': 'значение', 'content': 'значение'}</i>. Если таких ключей в словаре не окажется, по ним будут пустые значения или по ключу <i>title</i> будет строка длиной более 100 символов — снова появится исключение. При штатной отработке вернётся словарь с проверенными данными. Причём один ключ будет <i>title</i>, а вот второй — <i>text</i>. На это поведение влияет именованный аргумент <i>source</i>.

Если такой объём и формат исходящих/входящих данных вас устраивает, можно оставить один класс. Более развёрнутые примеры классов сериалайзера на запись я приведу в следующей статье.

<h2>Создаём экземпляр сериалайзера на запись</h2>
При создании в контроллере (view) экземпляра сериалайзера нужно подобрать правильный набор аргументов. Выбор зависит от того, какие запросы будут обрабатываться.

<table>
<thead>
  <tr>
    <th>Аргумент</th>
    <th>«На чтение» — обработка одной записи из БД или их набора для выдачи по GET-запросу</th>
    <th>«На запись» — создать новую запись в БД по POST-запросу</th>
    <th>«На запись» — обновить конкретную запись в БД по PUT- или PATCH-запросу</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td><b>instance</b></td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L493">Одна</a> или <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L655">несколько</a> записей из БД</td>
    <td>Не передаём </td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L199">Передаём запись</a> из БД, которую собираемся обновить</td>
  </tr>
  <tr>
    <td><b>data</b></td>
    <td>Не передаём</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/serializers.py#L460">Словарь</a> с данными, которые хотим валидировать и сохранить в БД. Если <i>many=True</i>, то передаём <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L624">список</a> словарей</td>
    <td>Словарь с данными для полного или частичного обновления существующей в БД записи. Если <i>many=True</i>, то передаём <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L624">список</a> словарей</td>
  </tr>
  <tr>
    <td><b>many</b></td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L141">Передаём</a> со значением True, если из БД извлекаем не одну, а несколько записей</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L141">Передаём</a> со значением True, если на вход поступают данные не для одной, а для нескольких будущих записей в БД</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L141">Передаём</a> со значением True, если хотим частично или полностью обновить сразу несколько записей в БД</td>
  </tr>
  <tr>
    <td><b>partial</b></td>
    <td>Не передаём</td>
    <td>Не передаём</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/fields.py#L501">Передаём</a> со значением True для PATCH-запросов</td>
  </tr>
  <tr>
    <td><b>context</b></td>
    <td colspan="3">Через этот аргумент можем <a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/serializers.py#L113">передать любые данные</a>, которые нужны сериалайзеру</td>
  </tr>
</tbody>
</table>
Пример:

<source lang="python">serializer = SerializerForUpdateData(
    instance=current_entry_in_db,
    data=input_data,
    partial=True
)</source>

Такие аргументы говорят нам, что экземпляр сериалайзера создан для частичного обновления существующей записи в БД.

<b>Важно:</b> входные данные, которые поступили в сериалайзер через аргумент <i>data</i> (то есть сырые, ещё не проверенные данные), доступны в атрибуте <i>initial_data</i> сериалайзера. К этим данным иногда приходится прибегать при описании логики валидации.

<h2>Валидируем с помощью сериалайзера входные данные</h2>
Это ключевая задача сериалайзера при работе на запись, поэтому уделим ей максимальное внимание.

Валидацию запускает метод <i>is_valid</i>. Итог его работы ―  два новых атрибута сериалайзера: <i>validated_data</i> и <i>errors</i>.

В каждом атрибуте ― словарь, причём один из них всегда пустой. Если ошибок нет, пусто в <i>errors</i>, а если есть ― в <i>validated_data</i>. В первом случае <i>is_valid</i> возвращает <i>True</i>, во втором <i>False</i>.

Рассмотрим, из чего состоят пары «ключ–значение» в этих словарях.

<table>
<thead>
  <tr>
    <th>Словарь</th>
    <th>Ключи</th>
    <th>Значения</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td><b>validated_data</b></td>
    <td>названия полей сериалайзера</td>
    <td>значения из поступившего в аргументе <i>data</i> словаря по ключам, имя которых <a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/fields.py#L449">идентично именам полей сериалайзера</a>, а также дефолтные значения полей сериалайзера (если входных данных нет)</td>
  </tr>
  <tr>
    <td><b>errors</b></td>
    <td>название полей сериалайзера либо <i>non_field_errors</i></td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/serializers.py#L309">расшифровки ошибок</a>, которые возникли при валидации полей, либо ошибки, возникшей при валидации вне конкретного поля</td>
  </tr>
</tbody>
</table>
Примеры:

<code>{'capital_city': 'London'} </code>

В поступившем в <i>data</i> словаре по ключу <i>capital_city</i> есть значение <i>‘London’</i>. Оно успешно валидировано через поле <i>capital_city</i> сериалайзера.

<code>{'non_field_errors': [ErrorDetail(string='Invalid data. Expected a dictionary, but got str.', code='invalid')]}. </code>

На вход в аргументе <i>data</i> сериалайзер ожидает словарь, но пришла строка.

<code>{'non_field_errors': [ErrorDetail(string='The fields country, capital_city must make a unique set.', code='unique')]}. </code>

Пара значений по ключам <i>capital_city</i> и <i>country</i> не должны повторять идентичное сочетание значений в таблице в БД.

<code>{'capital_city': [ErrorDetail(string='This field is required.', code='required')]}.</code>
 
В поступившем на вход словаре по ключу <i>capital_city</i> — пустая строка. Значение не прошло валидацию в поле <i>capital_city</i> сериалайзера, поскольку поле требует непустых значений.

Совпадение имён ключей в словаре, который поступает в сериалайзер, с именами полей сериалайзера ― принципиальная вещь. Если будут нестыковки, велика вероятность получить ошибку сразу или чуть позже, когда выяснится, что для записи в БД не хватает части данных, которые были на входе в сериалайзер.

У метода <i>is_valid</i> есть один аргумент ― <a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/serializers.py#L715"><i>raise_exception</i></a>. Если у него значение <i>False</i>, которое задано по умолчанию, метод <a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/serializers.py#L227">не будет выбрасывать <i>ValidationError</i></a>. Даже если будут ошибки, метод отработает до конца, вернёт <i>False</i>, а информация об ошибках будет доступна в атрибуте <i>errors</i>. На ошибки любых иных типов настройка <i>raise_exception</i> не влияет.

<h2>Как происходит валидация после запуска is_valid</h2>
Валидация носит многоступенчатый характер и условно её можно разделить на три этапа:

<ol>
	<li>Проверка, есть ли что валидировать.</li>
	<li>Проверки поступивших данных на уровне полей сериалайзера.</li>
	<li>Проверки на метауровне, когда можно проверить поступившие данные не для конкретного поля, а целиком.</li>
</ol>

<b>Важно:</b> ниже описывается процесс валидации данных, которые предназначены для одной записи в БД. Как и в случае с сериалайзером на чтение, на запись можно выставить <i>many=True</i> и принимать набор данных. Тогда появится ещё одна ступень проверки ― на входе будет ожидаться список словарей, а не один словарь. Далее по этому списку запускается цикл, и каждый отдельный словарь с данными будет проверяться так же, как описано ниже.

<h3>Этап 1. Есть ли что валидировать</h3>
DRF <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L213">проверяет</a>, есть ли у сериалайзера атрибут <i>initial_data</i>. Этот атрибут создаётся, если при создании сериалайзера <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L110">был передан</a> аргумент <i>data</i>. Если его нет, то будет выброшено исключение <i>AssertionError</i>.

Далее идёт проверка содержимого и формата <i>data</i>.

Если в <i>data</i> ничего не оказалось (<i>None</i>), то <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L543">возможны два исхода</a>:

<ul>
	<li><i>ValidationError</i>;</li>
	<li>окончание валидации с возвратом <i>None</i> в <i>validated_data</i>, если при создании сериалайзера передавали аргумент <i>allow_null</i> со значением <i>True</i>.</li>
</ul>

Если <i>data</i> всё же что-то содержит, DRF проверяет тип поступивших данных — они должны быть <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L460">словарём</a>.

<h3>Этап 2. Проверки на уровне полей</h3>
Важнейшие тезисы:

<ul>
	<li>если для конкретного ключа из поступившего словаря нет одноимённого writable-поля сериалайзера, пара «ключ–значение» останется за бортом валидации;</li>
	<li>если для конкретного writable-поля сериалайзера не окажется одноимённого ключа в поступившем словаре или ключ будет, но его значение <i>None</i>, может быть несколько вариантов развития событий. Либо поднимется исключение, либо продолжится валидация значения поля, либо поле будет проигнорировано;</li>
	<li>проверку, уже встроенную в класс конкретного поля, можно усилить валидаторами, а также описав собственный метод <i>validate_названиеПоля</i>;</li>
	<li>проверки идут последовательно по всем полям, и только после этого запускается следующий этап ― проверки на метауровне.</li>
</ul>

В методе <i>to_internal_value</i> сериалайзер собирает в генератор все поля, которые <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L470">могут работать на запись</a>, то есть те поля, у которых нет <i>read_only=Truе</i>. Затем сериалайзер <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L472">перебирает каждое поле в цикле</a>.

<table>
<thead>
  <tr>
    <th>Проверка</th>
    <th>Действие</th>
    <th>Результат</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>Есть ли у поля кастомный метод валидации?</td>
    <td>Для каждого поля внутри класса сериалайзера можно описать проверку значения с любой нужной логикой. Название метода должно быть в формате <i>validate_НазваниеПоля</i>.<br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L473">Исходный код</a></td>
    <td>Если метод есть, он будет задействован позднее.</td>
  </tr>
  <tr>
    <td>Есть ли в поступившем словаре ключ с тем же именем, что и поле сериалайзера?</td>
    <td>Задача ― извлечь значение для дальнейшей валидации.<br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L427">Исходный код</a></td>
    <td>Если ключ найден, для дальнейшей валидации берётся его значение, если не найден ― значение <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L44"><i>empty</i></a>.</td>
  </tr>
</tbody>
</table>

<h3>Этап 2.1. Валидирование отсутствующих значений для поля</h3>
Если для поля не нашлось одноимённого ключа в поступившем словаре, срабатывает <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L522">метод <i>validate_empty_values</i></a> класса <i>fields.Field</i> и <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L536">проверяет</a> допустимость значения <i>empty</i>.

<i>empty</i> ― это просто пустой класс. DRF передаёт его в качестве значения полям, для которых не нашлось значений во входных данных. Он помечает эти поля как пустые и валидирует определённым образом. Как поясняют разработчики DRF, необходимость в <i>empty</i> вызвана тем, что <i>None</i> вполне может быть валидным значением.

<table>
<thead>
  <tr>
    <th>Поле обязательно для заполнения <i>(required=True)</i></th>
    <th>Сериалайзер допускает частичное обновление <i>(partial=True)</i></th>
    <th>У поля есть дефолтное значение <i>(default=...)</i></th>
    <th>Результат</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>+</td>
    <td>Не имеет значения</td>
    <td>–<br>(<a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/fields.py#L304">и не может быть</a>, если <i>required=True</i>)</td>
    <td><i>ValidationError</i></td>
  </tr>
  <tr>
    <td>–</td>
    <td>Не имеет значения</td>
    <td>–</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L538">Поднимается</a> исключение <i>SkipField</i>, поле дальше <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L483"><b>не</b> валидируется</a> и <b>не</b> попадает в <i>validated_data</i></td>
  </tr>
  <tr>
    <td>–</td>
    <td>+</td>
    <td>+</td>
    <td>Поле дальше <b>не</b> валидируется и <b>не</b> попадает в <i>validated_data</i></td>
  </tr>
  <tr>
    <td>–</td>
    <td>–</td>
    <td>+</td>
    <td>Поле <b>валидируется</b> дальше и вместе с дефолтным значением <b>попадает</b> в <i>validated_data</i></td>
  </tr>
</tbody>
</table>

<b>Примечание:</b> результат, попадает или не попадает поле в <i>validated_data</i>, указан с условием того, что остальные поля успешно прошли валидацию. Если хотя бы одно поле провалит проверку, словарь <i>validated_data</i> всегда будет пустым.

<b>Если в поле значение <i>None</i></b>, работает <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L522">метод <i>validate_empty_values</i></a> класса <i>fields.Field</i>.

В этом случае <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L543">проверяется</a>, есть ли у поля атрибут <i>allow_null</i> в значении <i>True</i>. Если его нет, появится <i>ValidationError</i>. Если <i>allow_null=True</i>, дальнейшая валидация внутри поля прекратится. Если значение <i>None</i> пройдёт проверку вне поля (метавалидаторами), то это значение и войдёт в <i>validated_data</i>.

После проверок на <i>empty</i> и <i>None</i> запускаются проверочные механизмы внутри конкретного поля.

<h3>Этап 2.2. Проверка в поле методом to_internal_value</h3>

<b>Важно:</b> если значение <i>empty</i> или <i>None</i>, проверка <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L566">не проводится</a>.

У каждого поля DRF, которое может работать на запись, есть метод <i>to_internal_value</i>. Чтобы понять логику этого метода, нужно заглянуть под капот в класс соответствующего поля.

Приведу <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L801">пример</a> ― <i>to_internal_value</i> поля класса <i>CharField</i>.

<source lang="python">    def to_internal_value(self, data):
        if isinstance(data, bool) or not isinstance(data, (str, int, float,)):
            self.fail('invalid')
        value = str(data)
        return value.strip() if self.trim_whitespace else value</source>

Проверка выдаст ошибку, если на вход не поступила строка или число. Также не допускаются логические типы <i>True</i> и <i>False</i>. Проверку на наличие последних разработчики выделили отдельно, т. к. класс <i>bool</i> наследует от класса <i>int</i>.

Если вы собираетесь использовать кастомный класс поля для валидации входных данных, проследите, чтобы там был метод <i>to_internal_value</i>, иначе DRF <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L610">укажет на ошибку</a>.

<h3>Этап 2.3. Проверка поля валидаторами</h3>
<b>Важно:</b> проверка <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L566">не проводится</a>, если значение <i>empty</i> или <i>None</i>.

При объявлении поля сериалайзера среди аргументов можно указать:

<ul>
	<li>встроенные <a href="https://www.djbook.ru/rel3.0/ref/validators.html#built-in-validators">джанго-валидаторы</a> (например, проверку максимальной длины строки, минимально допустимого числового значения);</li>
	<li>встроенные <a href="https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/validators#uniquevalidator">DRF-валидаторы</a>;</li>
	<li><a href="https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/validators#napisanie-polzovatelskikh-validatorov">собственные валидаторы</a> в виде функции или класса.</li>

</ul>

Валидаторы передаются списком в аргументе <i>validators</i> при описании поля сериалайзера, даже если валидатор всего один. Некоторые валидаторы можно передать через специально предусмотренные атрибуты конкретного поля. Например, у поля сериалайзера <i>IntegerField</i> есть аргумент <a href="https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/fields#integerfield"><i>max_value</i></a>, который создаёт джанго-валидатор <i>MaxValueValidator</i>. Поэтому оба варианта будут верны, но в первом случае нужно ещё сделать импорт из <i>django.core.validators</i>:

<source lang="python">capital_population = serializers.IntegerField(
    validators=[MaxValueValidator(1000000)]
)

capital_population = serializers.IntegerField(
    max_value=1000000
)</source>

Также отмечу, что некоторые поля могут наделяться валидаторами из-под капота без необходимости объявлять их явно. Например, в поле <i>CharField</i> уже заложены два валидатора, названия которых говорят сами за себя: джанго-валидатор <a href="https://www.djbook.ru/rel3.0/ref/validators.html#prohibitnullcharactersvalidator"><i>ProhibitNullCharactersValidator</i></a> и DRF-валидатор <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/validators.py#L170"><i>ProhibitSurrogateCharactersValidator</i></a>. 

<h3>Этап 2.4. Проверка кастомным методом validate_названиеПоля</h3>
Этот метод <b>не</b> обязателен, и мы его описываем, когда нужно дополнительно проверить значение, уже отвалидированное внутри поля описанными выше инструментами.

Логику задаём любую. Результат работы метода ― возврат значения или ошибки. Скелет метода можно представить так:

<source lang="python">def validate_НазваниеПоляСериалайзера(self, value):
    if условия_при_которых_значение_невалидно:
        raise serializers.ValidationError("Описание ошибки")
    return value</source>

Обратите внимание на <i>self</i> — за ним стоит экземпляр сериалайзера. Через него есть доступ к различной ценной информации, которая может пригодиться при валидации. Например, через <i>self.initial_data </i>можно получить доступ ко всему словарю с входными данными до начала их валидации.

И ещё один момент, который следует держать в голове при описании логики метода: если допускается, что поле будет пустым, и есть дефолтное значение, а также если в поле можно передавать <i>None</i>, эти значения также будут поступать в рассматриваемый метод. 

<h3>Этап 2.5. Присвоение имени ключу с успешно валидированным в поле значением</h3>
В случае успеха метод <i>to_internal_value</i> сериалайзера возвращает словарь с проверенными данными. По умолчанию именем ключа становится имя поля сериалайзера. Но это поведение можно переопределить благодаря атрибуту <i>source</i>, о котором мы подробно говорили <a href="https://habr.com/ru/company/yandex_praktikum/blog/562050/">в статьях о работе сериалайзера на чтение</a>.

Если у поля есть атрибут <i>source</i>, то именем ключа станет не имя соответствующего поля, а значение из атрибута <i>source</i>. Такая логика описана в функции <a href="https://github.com/encode/django-rest-framework/blob/e92016ac2e926483e05e296558fc3d1ea3279625/rest_framework/fields.py#L112"><i>set_values</i></a> модуля <i>restframework.fields</i>. Эта функция <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L486">вызывается в конце работы</a> <i>to_internal_value</i> и получает в качестве аргумента keys атрибут <i>source_attrs</i> поля (мы подробно разбирали его в <a href="https://habr.com/ru/company/yandex_praktikum/blog/562050/">предыдущей статье</a>).

Обратимся к примеру.

<source lang="python">content = serializers.CharField(source='text')</source>
 
Если это поле используется при работе на запись, то сериалайзер будет искать во входных данных ключ <i>content</i> и валидировать значение по этому ключу методом <i>to_internal_value</i>. В случае успеха он вернёт ― <b>внимание!</b> ― валидированное значение уже с ключом <i>'text'.</i> Получится <i>'text': 'валидированное значение, которое пришло с ключом content'</i>. Именно в таком виде пара «ключ–значение» попадут в <i>validated_data</i>, но только если пройдут следующий этап ― проверку метавалидаторами.

<h3>Этап 3. Проверка на уровне всего сериалайзера</h3>
Этап разбивается на две части.

<b>Этап 3.1. Проверка метавалидаторами</b>
Эти валидаторы не привязаны к конкретному полю и получают на вход весь набор данных, которые прошли проверку в полях.

Чтобы задать метавалидатор, нужно прописать внутри класса нашего сериалайзера класс <i>Meta</i> с атрибутом <i>validators</i>. Как и валидаторы на уровне полей, метавалидаторы <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L380">указывают списком</a>, даже если валидатор один.

Пример метавалидатора из коробки ― <a href="https://ilyachch.gitbook.io/django-rest-framework-russian-documentation/overview/navigaciya-po-api/validators#uniquetogethervalidator"><i>UniqueTogetherValidator</i></a>. Он проверяет, уникально ли сочетание значений из нескольких полей по сравнению с тем, что уже есть в БД.

<b>Этап 3.2. Проверка методом validate</b>
Последний рубеж валидации так же, как и метавалидаторы, опционален. Заготовка метода <i>validate</i> уже находится <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L519">под капотом</a> родительского класса сериалайзера.

<source lang="python">    def validate(self, attrs):
        return attrs</source>

Если в нём есть необходимость, достаточно переопределить метод. 

Метод <i>validate</i>, как и метавалидаторы, на вход принимает весь набор валидированных данных и позволяет сверить их между собой и с данными в БД в одном месте.

<h2>Для закрепления: таблица с последовательностью валидирования входных данных в DRF</h2>
<table>
<thead>
  <tr>
    <th>Этап</th>
    <th>Что проверяется</th>
    <th>Метод</th>
    <th>Примечание</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>1</td>
    <td>Передан ли аргумент <i>data</i> при создании сериалайзера</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L212"><i>serializers.BaseSerializer.</i></a><br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L212"><i>is_valid</i></a></td>
    <td>—</td>
  </tr>
  <tr>
    <td>2</td>
    <td>Если в <i>data</i> сериалайзеру передано <i>None</i>, допустимо ли это</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L543"><i>fields.Field.</i></a><br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L543"><i>validate_empty_values</i></a></td>
    <td>Если передано <i>Non</i>e, валидация завершается</td>
  </tr>
  <tr>
    <td>3</td>
    <td>Передан ли в <i>data</i> словарь</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L460"><i>serializers.Serializer.</i></a><br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L460"><i>to_internal_value</i></a></td>
    <td>—</td>
  </tr>
</tbody>
</table>

Метод <a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/serializers.py#L472"><i>serializers.Serializer.to_internal_value</i></a> запускает цикл по всем writable-полям со следующими проверками по каждому полю:

<table>
<thead>
  <tr>
    <th>Этап</th>
    <th>Что проверяется</th>
    <th>Метод</th>
    <th>Примечание</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>4</td>
    <td>Есть ли в <i>data</i> ключ с таким же именем, что и поле сериалайзера</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L449"><i>fields.Field.</i></a><br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L449"><i>get_value</i></a></td>
    <td>Если ключа нет или по нему нет значения и это допустимо, значением поля становится класс <i>empty</i></td>
  </tr>
  <tr>
    <td>5</td>
    <td>Если значение поля <i>empty</i>, есть ли у поля дефолтное значение</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L492"><i><i>fields.Field.</i></i></a><br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L492"><i><i>get_default</i></i></a></td>
    <td>Если дефолтного значения нет, поле исключается из валидации. В <i>validated_data</i> оно никак не будет представлено</td>
  </tr>
  <tr>
    <td>6</td>
    <td>Если значение из входных данных <i>None</i>, допускает ли поле это</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L543"><i>fields.Field.</i></a><br><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L543"><i>validate_empty_values</i></a></td>
    <td>Допустимость определяется значением атрибута <i>allow_null</i> поля</td>
  </tr>
  <tr>
    <td>7</td>
    <td>Соответствует ли значение внутренним требованиям поля</td>
    <td><i>fields.Field.</i><br><i>классКонкретногоПоля.</i><br><i>to_internal_value</i></td>
    <td>Проверка не проводится, если значение <i>empty</i> или <i>None</i></td>
  </tr>
  <tr>
    <td>8</td>
    <td>Проходят ли значение валидаторы, которые встроены в поле или приданы ему</td>
    <td><a href="https://github.com/encode/django-rest-framework/blob/24a938abaadd98b5482bec33defd285625842342/rest_framework/fields.py#L572"><i>fields.Field.run_validators</i></a></td>
    <td>Не предусмотренные изначально валидаторы нужно установить самостоятельно.<br>Проверка не проводится, если значение <i>empty</i> или <i>None</i></td>
  </tr>
  <tr>
    <td>9</td>
    <td>Проходит ли значение поля проверку кастомным методом валидации</td>
    <td>метод <i>validate_НазваниеПоля класса сериалайзера</i></td>
    <td>Логику метода нужно описать самостоятельно</td>
  </tr>
</tbody>
</table>

Потом следуют метапроверки, которые можно запустить после окончания цикла проверки каждого поля.

<table>
<thead>
  <tr>
    <th>Этап</th>
    <th>Что проверяется</th>
    <th>Метод</th>
    <th>Примечание</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td>10</td>
    <td>Проходят ли значения полей метавалидаторы</td>
    <td>атрибут <i>validators</i> класса <i>Meta</i> сериалайзера</td>
    <td>Для проверки валидаторы нужно задать самостоятельно</td>
  </tr>
  <tr>
    <td>11</td>
    <td>Проходят ли все значения полей вместе проверку кастомным методом сериалайзера</td>
    <td>метод <i>validate</i> сериалайзера</td>
    <td>Для проверки логику метода нужно описать самостоятельно</td>
  </tr>
</tbody>
</table>

При работе с <i>ModelSerializer</i> валидаторы из модели могут автоматически переноситься в сериалайзер, поэтому вручную их можно не указывать. Об этом мы поговорим в отдельной статье о <i>ModelSerializer</i>.

<hr>